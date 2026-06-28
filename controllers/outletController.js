const Outlet = require('../models/outletModel');
const OutletProduct = require('../models/outletProductModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

// ─── Helpers ───────────────────────────────────────────────

const findOutletOrFail = async (outletId, next) => {
  const outlet = await Outlet.findById(outletId).lean();
  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  return outlet;
};

const assertOwner = (outlet, userId, next) => {
  if (!outlet.owner.equals(userId)) {
    return next(new AppError('FORBIDDEN', 403));
  }
};

const assertOwnerOrWorker = (outlet, userId, next) => {
  const isOwner = outlet.owner.equals(userId);
  const isWorker = outlet.workers?.some((w) => w.user.equals(userId));
  if (!isOwner && !isWorker) return next(new AppError('FORBIDDEN', 403));
};

// ─── CREATE OUTLET ─────────────────────────────────────────
// POST /api/v1/outlets
exports.createOutlet = catchAsync(async (req, res, next) => {
  const { name, type } = req.body;

  if (!name) return next(new AppError('OUTLET_NAME_REQUIRED', 400));
  if (!['store', 'warehouse', 'delivery'].includes(type)) {
    return next(new AppError('INVALID_OUTLET_TYPE', 400));
  }

  const [outlet] = await Promise.all([
    Outlet.create({ name, owner: req.user._id, type }),
    User.findByIdAndUpdate(req.user._id, { role: 'owner' }),
  ]);

  res.status(201).json({ status: 'success', data: { outlet } });
});

// ─── GET ALL OUTLETS ───────────────────────────────────────
// GET /api/v1/outlets?type=store
exports.getAllOutlets = catchAsync(async (req, res, next) => {
  const role = req.user.role;
  let ownerId;

  if (role === 'owner') {
    ownerId = req.user._id;
  } else if (role === 'worker') {
    ownerId = req.user.owner;
  }
  const features = new APIFeatures(Outlet.find({ owner: ownerId }), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const outlets = await features.query.lean();

  // Batch count products for all outlets in one query
  const outletIds = outlets.map((o) => o._id);
  const productCounts = await OutletProduct.aggregate([
    { $match: { outlet: { $in: outletIds } } },
    { $group: { _id: '$outlet', count: { $sum: 1 } } },
  ]);

  // Map counts to outlets
  const countMap = Object.fromEntries(
    productCounts.map((p) => [p._id.toString(), p.count])
  );

  const outletsWithCount = outlets.map((outlet) => ({
    ...outlet,
    productsCount: countMap[outlet._id.toString()] || 0,
  }));

  res.status(200).json({
    status: 'success',
    results: outlets.length,
    data: { outlets: outletsWithCount },
  });
});

// ─── GET SINGLE OUTLET ─────────────────────────────────────
// GET /api/v1/outlets/:outletId
exports.getOutlet = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findById(req.params.outletId)
    .populate('owner', 'name role')
    .lean();

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const isOwner = outlet.owner._id.equals(req.user._id);
  const isWorker = outlet.workers?.some((w) => w.user.equals(req.user._id));
  if (!isOwner && !isWorker) return next(new AppError('FORBIDDEN', 403));

  res.status(200).json({ status: 'success', data: { outlet } });
});

// ─── GET MY OUTLET (worker) ────────────────────────────────
// GET /api/v1/outlets/my-outlet
exports.getMyOutlet = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findOne({
    'workers.user': req.user._id,
  }).lean();

  if (!outlet) return next(new AppError('NOT_ATTACHED_TO_OUTLET', 404));

  const productsCount = await OutletProduct.countDocuments({
    outlet: outlet._id,
  });

  res.status(200).json({
    status: 'success',
    data: { outlet: { ...outlet, productsCount } },
  });
});   

// ─── UPDATE OUTLET ─────────────────────────────────────────
// PATCH /api/v1/outlets/:outletId
exports.updateOutlet = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findById(req.params.outletId)
    .select('owner')
    .lean();
  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!outlet.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  const updated = await Outlet.findByIdAndUpdate(
    req.params.outletId,
    { name: req.body.name },
    { new: true, runValidators: true }
  ).lean();

  res.status(200).json({ status: 'success', data: { outlet: updated } });
});

// ─── DELETE OUTLET ─────────────────────────────────────────
// DELETE /api/v1/outlets/:outletId
exports.deleteOutlet = catchAsync(async (req, res, next) => {
  const outlet = await Outlet.findById(req.params.outletId)
    .select('owner')
    .lean();
  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!outlet.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  // Delete outlet and all its products in parallel
  await Promise.all([
    Outlet.findByIdAndDelete(req.params.outletId),
    OutletProduct.deleteMany({ outlet: req.params.outletId }),
  ]);

  res.status(204).json({ status: 'success', data: null });
});

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

// ─── ADD PRODUCT TO OUTLET ─────────────────────────────────
// POST /api/v1/outlets/:outletId/products
exports.addProductToOutlet = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (!productId) return next(new AppError('PRODUCT_ID_REQUIRED', 400));
  if (!quantity || quantity <= 0)
    return next(new AppError('INVALID_QUANTITY', 400));

  // Fetch outlet and product in parallel
  const [outlet, product] = await Promise.all([
    Outlet.findById(req.params.outletId).select('owner').lean(),
    Product.findById(productId).lean(),
  ]);

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!outlet.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));
  if (!product) return next(new AppError('PRODUCT_NOT_FOUND', 404));
  if (!product.owner.equals(outlet.owner))
    return next(new AppError('PRODUCT_NOT_OWNED', 403));

  const outletProduct = await OutletProduct.findOneAndUpdate(
    { outlet: req.params.outletId, product: product._id },
    {
      $inc: { quantity },
      $setOnInsert: {
        outlet: req.params.outletId,
        product: product._id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        barcode: product.barcode,
        pricing: product.pricing,
      },
    },
    { new: true, upsert: true }
  ).lean();

  res.status(200).json({ status: 'success', data: { outletProduct } });
});

// ─── REMOVE PRODUCT FROM OUTLET ────────────────────────────
// DELETE /api/v1/outlets/product/:productId
exports.removeProductFromOutlet = catchAsync(async (req, res, next) => {
  const outletProduct = await OutletProduct.findById(req.params.productId)
    .populate('outlet', 'owner')
    .lean();

  if (!outletProduct) return next(new AppError('PRODUCT_NOT_FOUND', 404));
  if (!outletProduct.outlet.owner.equals(req.user._id)) {
    return next(new AppError('FORBIDDEN', 403));
  }

  await OutletProduct.findByIdAndDelete(req.params.productId);

  res.status(204).json({ status: 'success', data: null });
});

exports.getLowStock = catchAsync(async (req, res, next) => {
  const threshold = Number(req.query.threshold) || 5;

  const outlet = await Outlet.findById(req.params.outletId)
    .select('owner workers')
    .lean();

  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const isOwner = outlet.owner.equals(req.user._id);
  const isWorker = outlet.workers?.some((w) => w.user.equals(req.user._id));
  if (!isOwner && !isWorker) return next(new AppError('FORBIDDEN', 403));

  const lowStock = await OutletProduct.find({
    outlet: req.params.outletId,
    quantity: { $lte: threshold },
  })
    .select('name model quantity pricing')
    .lean();

  res.status(200).json({
    status: 'success',
    results: lowStock.length,
    data: { products: lowStock },
  });
});
