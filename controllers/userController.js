const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ─── Helpers ───────────────────────────────────────────────

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// ─── GET MY PROFILE ────────────────────────────────────────
// GET /api/v1/users/getMe
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).lean();

  res.status(200).json({ status: 'success', data: { user } });
});

// ─── UPDATE MY PROFILE ─────────────────────────────────────
// PATCH /api/v1/users/updateMe
exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('USE_UPDATE_PASSWORD_ROUTE', 400));
  }

  const filteredBody = filterObj(req.body, 'name', 'email', 'phone', 'username', 'surname');

  // Remove empty strings — don't overwrite with empty
  Object.keys(filteredBody).forEach((key) => {
    if (filteredBody[key] === '') delete filteredBody[key];
  });

  const user = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  }).lean();

  res.status(200).json({ status: 'success', data: { user } });
});

// ─── DELETE MY ACCOUNT ─────────────────────────────────────
// DELETE /api/v1/users/deleteMe
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({ status: 'success', data: null });
});

// ─── ADMIN — GET ALL USERS ─────────────────────────────────
// GET /api/v1/users
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find().lean();

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users },
  });
});

// ─── ADMIN — GET SINGLE USER ───────────────────────────────
// GET /api/v1/users/:id
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).lean();

  if (!user) return next(new AppError('USER_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { user } });
});

// ─── ADMIN — UPDATE USER ───────────────────────────────────
// PATCH /api/v1/users/:id
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).lean();

  if (!user) return next(new AppError('USER_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { user } });
});

// ─── ADMIN — DELETE USER ───────────────────────────────────
// DELETE /api/v1/users/:id
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id).lean();

  if (!user) return next(new AppError('USER_NOT_FOUND', 404));

  res.status(204).json({ status: 'success', data: null });
});

// ─── NOT IMPLEMENTED ───────────────────────────────────────
exports.createUser = (req, res) => {
  res.status(405).json({
    status: 'error',
    code: 'USE_SIGNUP_ROUTE',
  });
};