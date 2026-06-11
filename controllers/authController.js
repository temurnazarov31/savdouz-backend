const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendSMS = require('../utils/sendSMS');
const sendEmail = require('../utils/sendEmail');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });
  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

const generateOTP = () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  return { code, hashed, expiresAt };
};

const hashCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex');

const sendOTPToUser = async (user, code) => {
  if (user.phone) {
    await sendSMS(user.phone, `SavdoUz tasdiqlash kodi: ${code}`);
  } else if (user.email) {
    await sendEmail(
      user.email,
      'SavdoUz verification code',
      `Your code is: ${code}. Valid for 10 minutes.`
    );
  }
};

// Rate limit: don't allow new OTP within 60 seconds of last send
const canResend = (lastSentAt) => {
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() >= 60_000;
};

exports.signup = catchAsync(async (req, res, next) => {
  const { username, name, surname, email, phone, password, passwordConfirm } =
    req.body;

  if (!username) {
    return next(new AppError('Please provide username', 400));
  }

  if (username) {
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return next(new AppError('This username already in use', 400));
    }
  }

  if (email) {
    const existingEmail = await User.findOne({ email }).select("email");
    if (existingEmail) {
      return next(new AppError('Email already in use', 400));
    }
  }

  if (phone) {
    const existingPhone = await User.findOne({ phone }).select("phone");
    if (existingPhone) return next(new AppError('Phone already in use', 400));
  }

  const { code, hashed, expiresAt } = generateOTP();

  const newUser = await User.create({
    username,
    name,
    surname,
    email: req.body.email || undefined,
    phone: req.body.phone || undefined,
    password,
    passwordConfirm,
    isVerified: false,
    verification: {
      code: hashed,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
  });

  await sendOTPToUser(newUser, code);

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const loginInput = req.body.email || req.body.phone || req.body.username;
  const { password } = req.body;

  if (!loginInput) {
    return next(new AppError('LOGIN_INPUT_REQUIRED', 400));
  }
  if (!password) {
    return next(new AppError('Please provide password', 400));
  }

  // Find by email or phone
  const user = await User.findOne({
    $or: [
      { username: loginInput },
      { email: loginInput },
      { phone: loginInput },
    ],
  }).select('+password +role username email phone');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 400));
  }

  createSendToken(user, 200, req, res);
});

exports.logout = catchAsync(async (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it is there
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt && req.cookies.jwt !== 'loggedout') {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify).call(
    jwt,
    token,
    process.env.JWT_SECRET
  );

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if uesr changed password after the token was issued

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in', 401));
    }
    // roles ['admin', 'owner']. role = 'user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// ────────────────────────────────────────────────────────────
// POST /api/v1/auth/verify-otp
// ────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { email, phone, code } = req.body;

    if (!code || (!email && !phone)) {
      return res.status(400).json({ code: 'MISSING_FIELDS' });
    }

    const user = await User.findOne(email ? { email } : { phone }).select(
      '+verification.code'
    );

    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND' });

    if (user.isVerified) {
      return res.status(400).json({ code: 'ALREADY_VERIFIED' });
    }

    if (user.verification.attempts >= 5) {
      return res.status(429).json({ code: 'OTP_LOCKED' });
    }

    if (user.verification.expiresAt < new Date()) {
      return res.status(400).json({ code: 'OTP_EXPIRED' });
    }

    if (user.verification.code !== hashCode(code)) {
      user.verification.attempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ code: 'OTP_INVALID' });
    }

    user.isVerified = true;
    user.verification = undefined;
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.status(200).json({
      code: 'VERIFIED',
      token,
      data: { user: { id: user._id, name: user.name, role: user.role } },
    });
  } catch (err) {
    console.error('verifyOTP error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/v1/auth/resend-otp
// ────────────────────────────────────────────────────────────
exports.resendOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ code: 'MISSING_FIELDS' });
    }

    const user = await User.findOne(email ? { email } : { phone }).select("email, phone");
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND' });

    if (user.isVerified) {
      return res.status(400).json({ code: 'ALREADY_VERIFIED' });
    }

    if (!canResend(user.verification?.lastSentAt)) {
      return res.status(429).json({ code: 'OTP_TOO_SOON' });
    }

    const { code, hashed, expiresAt } = generateOTP();

    user.verification = {
      code: hashed,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    };
    await user.save({ validateBeforeSave: false });

    await sendOTPToUser(user, code);

    res.status(200).json({ code: 'OTP_SENT' });
  } catch (err) {
    console.error('resendOTP error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
// ────────────────────────────────────────────────────────────
// Always returns same success response — don't leak which emails/phones exist
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ code: 'MISSING_FIELDS' });
    }

    const user = await User.findOne(email ? { email } : { phone }).select("email, phone");

    // Generic success response either way (security: don't leak existence)
    if (!user) {
      return res.status(200).json({ code: 'OTP_SENT_IF_EXISTS' });
    }

    if (!canResend(user.verification?.lastSentAt)) {
      return res.status(429).json({ code: 'OTP_TOO_SOON' });
    }

    const { code, hashed, expiresAt } = generateOTP();

    user.verification = {
      code: hashed,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    };
    await user.save({ validateBeforeSave: false });

    await sendOTPToUser(user, code);

    res.status(200).json({ code: 'OTP_SENT_IF_EXISTS' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/v1/auth/reset-password
// ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, phone, code, newPassword } = req.body;

    if (!code || !newPassword || (!email && !phone)) {
      return res.status(400).json({ code: 'MISSING_FIELDS' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ code: 'PASSWORD_TOO_SHORT' });
    }

    const user = await User.findOne(email ? { email } : { phone }).select(
      '+verification.code +password email phone'
    );

    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND' });

    if (!user.verification?.code) {
      return res.status(400).json({ code: 'OTP_NOT_REQUESTED' });
    }

    if (user.verification.attempts >= 5) {
      return res.status(429).json({ code: 'OTP_LOCKED' });
    }

    if (user.verification.expiresAt < new Date()) {
      return res.status(400).json({ code: 'OTP_EXPIRED' });
    }

    if (user.verification.code !== hashCode(code)) {
      user.verification.attempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ code: 'OTP_INVALID' });
    }

    user.password = newPassword; // pre-save hook should hash it
    user.verification = undefined;
    await user.save();

    const token = signToken(user._id);

    res.status(200).json({
      code: 'PASSWORD_RESET',
      token,
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
};

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  createSendToken(user, 200, req, res);
});
