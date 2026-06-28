const Outlet = require('../models/outletModel');
const OutletProduct = require('../models/outletProductModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ─── GET OUTLET PRODUCTS ───────────────────────────────────
// GET /api/v1/outlets/products/:outletId
exports.getOutletProducts = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findById(req.params.outletId)
    .select('owner workers')
    .lean();

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const isOwner = outlet.owner.equals(req.user._id);
  const isWorker = outlet.workers?.some((w) => w.user.equals(req.user._id));
  if (!isOwner && !isWorker) return next(new AppError('FORBIDDEN', 403));

  const products = await OutletProduct.find({ outlet: req.params.outletId })
    .select('-__v')
    .lean();

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: { products },
  });
});

// ─── GET SINGLE OUTLET PRODUCT ─────────────────────────────
// GET /api/v1/outlets/product/:id
exports.getOutletProduct = catchAsync(async (req, res, next) => {
  const outletProduct = await OutletProduct.findById(req.params.id)
    .select('-__v')
    .lean();

  if (!outletProduct) return next(new AppError('PRODUCT_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { outletProduct } });
});

// ─── UPDATE OUTLET PRODUCT ─────────────────────────────────
// PATCH /api/v1/outlets/product/:id
exports.updateOutletProduct = catchAsync(async (req, res, next) => {
  // Fetch product and its outlet in parallel
  const outletProduct = await OutletProduct.findById(req.params.id)
    .select('outlet')
    .lean();

  if (!outletProduct) return next(new AppError('PRODUCT_NOT_FOUND', 404));

  const outlet = await Outlet.findById(outletProduct.outlet)
    .select('owner')
    .lean();

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!outlet.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  const updated = await OutletProduct.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).lean();

  res.status(200).json({ status: 'success', data: { outletProduct: updated } });
});

// ─── DELETE OUTLET PRODUCT ─────────────────────────────────
// DELETE /api/v1/outlets/product/:id
exports.deleteOutletProduct = catchAsync(async (req, res, next) => {
  const outletProduct = await OutletProduct.findById(req.params.id)
    .select('outlet')
    .lean();

  if (!outletProduct) return next(new AppError('PRODUCT_NOT_FOUND', 404));

  const outlet = await Outlet.findById(outletProduct.outlet)
    .select('owner')
    .lean();

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!outlet.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  await OutletProduct.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});
