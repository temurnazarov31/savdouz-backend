const crypto = require('crypto');
const Outlet = require('../models/outletModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ─── GENERATE INVITE ───────────────────────────────────────
// POST /api/v1/outlets/:outletId/invite
exports.generateInvite = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findById(req.params.outletId).select(
    'owner inviteToken'
  );

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!outlet.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  // Generate and save token directly on outlet
  const token = crypto.randomBytes(32).toString('hex');
  outlet.inviteToken = token;
  await outlet.save();

  res.status(201).json({
    status: 'success',
    data: { token },
  });
});

// ─── JOIN OUTLET ───────────────────────────────────────────
// POST /api/v1/outlets/join/:token
exports.joinOutlet = catchAsync(async (req, res, next) => {
  const role = req.user.role
  if (role === 'owner' ) {
    return next(new AppError('CANNOT_JOIN_TO_THE_STORE', 400));
  }
  const { token } = req.params;

  const outlet = await Outlet.findOne({ inviteToken: token }).select(
    '+inviteToken owner workers'
  );

  if (!outlet) return next(new AppError('INVALID_TOKEN', 400));

  const alreadyWorker = outlet.workers.some((w) => w.user.equals(req.user._id));
  if (alreadyWorker) return next(new AppError('ALREADY_WORKER', 400));

  outlet.workers.push({ user: req.user._id, name: req.user.name });
  await outlet.save();

  await User.findByIdAndUpdate(req.user._id, {
    role: 'worker',
    owner: outlet.owner,
  });

  res.status(200).json({ status: 'success', data: { outlet } });
});
