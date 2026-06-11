const Outlet = require('../models/outletModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ─── GET ALL WORKERS ───────────────────────────────────────
// GET /api/v1/workers
exports.getAllWorkers = catchAsync(async (req, res, next) => {
  const workers = await User.find({ owner: req.user._id, role: 'worker' })
    .select('name email phone username role')
    .lean();

  res.status(200).json({
    status: 'success',
    results: workers.length,
    data: { workers },
  });
});

// ─── GET SINGLE WORKER ─────────────────────────────────────
// GET /api/v1/workers/:id
exports.getWorker = catchAsync(async (req, res, next) => {
  const worker = await User.findOne({
    _id: req.params.id,
    owner: req.user._id,
    role: 'worker',
  })
    .select('name email phone username role')
    .lean();

  if (!worker) return next(new AppError('WORKER_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { worker } });
});

// ─── REMOVE WORKER ─────────────────────────────────────────
// DELETE /api/v1/workers/:outletId/:workerId
exports.removeWorker = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findOne({
    _id: req.params.outletId,
    owner: req.user._id,
  }).select('owner workers');

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const workerExists = outlet.workers.some((w) =>
    w.user.equals(req.params.workerId)
  );
  if (!workerExists) return next(new AppError('WORKER_NOT_IN_OUTLET', 404));

  // Remove from outlet and reset user in parallel
  outlet.workers = outlet.workers.filter(
    (w) => !w.user.equals(req.params.workerId)
  );

  await Promise.all([
    outlet.save(),
    User.findByIdAndUpdate(req.params.workerId, {
      $unset: { owner: 1, storeId: 1 },
      role: 'user',
    }),
  ]);

  res.status(204).json({ status: 'success', data: null });
});
