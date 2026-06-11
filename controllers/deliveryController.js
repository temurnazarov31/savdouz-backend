// controllers/deliveryController.js
const Delivery = require('../models/deliveryModel');
const Outlet = require('../models/outletModel');
const OutletProduct = require('../models/outletProductModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Helper to get product from source
const getSourceProduct = async (outletId, productId) => {
  return await OutletProduct.findOne({
    outlet: outletId,
    product: productId,
  });
};

// Helper to add product to destination
const addToDestination = async (
  type,
  outletId,
  productId,
  name,
  brand, 
  model,
  barcode,
  pricing,
  quantity
) => {
  const existing = await OutletProduct.findOne({
    outlet: outletId,
    product: productId,
  });
  if (existing) {
    existing.quantity += quantity;
    await existing.save();
  } else {
    await OutletProduct.create({
      outlet: outletId,
      product: productId,
      name,
      brand,
      model,
      barcode,
      pricing,
      quantity,
    });
  }
};

// Helper to verify ownership
const verifyAccess = async (outletId, userId) => {
  const outlet = await Outlet.findById(outletId).select('owner workers').lean();
  if (!outlet) return false;
  const isOwner = outlet.owner.equals(userId);
  const isWorker = outlet.workers?.some((w) => w.user.equals(userId));
  return isOwner || isWorker;
};

// Create delivery
exports.createDelivery = catchAsync(async (req, res, next) => {
  const { fromType, fromId, toType, toId, products, note } = req.body;

  if (!fromType || !fromId || !toType || !toId)
    return next(new AppError('SOURCE_DEST_REQUIRED', 400));
  if (
    !['store', 'warehouse'].includes(fromType) ||
    !['store', 'warehouse'].includes(toType)
  )
    return next(new AppError('INVALID_OUTLET_TYPE', 400));
  if (fromId === toId) return next(new AppError('SAME_SOURCE_DEST', 400));
  if (!products || products.length === 0)
    return next(new AppError('PRODUCTS_REQUIRED', 400));

  const ownsFrom = await verifyAccess(fromId, req.user._id);
  if (!ownsFrom) return next(new AppError('NO_ACCESS_TO_SOURCE', 403));

  const ownsTo = await verifyAccess(toId, req.user._id);
  if (!ownsTo) return next(new AppError('NO_ACCESS_TO_DESTINATION', 403));

  // fetch outlet names for snapshot
  const [sourceOutlet, destOutlet] = await Promise.all([
    Outlet.findById(fromId).select('name').lean(),
    Outlet.findById(toId).select('name').lean(),
  ]);
  if (!sourceOutlet) return next(new AppError('OUTLET_NOT_FOUND', 404));
  if (!destOutlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const deliveryProducts = [];

  for (const item of products) {
    const { productId, quantity } = item;

    if (!quantity || quantity <= 0)
      return next(new AppError('INVALID_QUANTITY', 400));

    const sourceProduct = await getSourceProduct(fromId, productId);

    if (!sourceProduct) return next(new AppError('PRODUCT_NOT_IN_SOURCE', 404));

    if (sourceProduct.quantity < quantity)
      return next(new AppError('INSUFFICIENT_STOCK', 400));

    sourceProduct.quantity -= quantity;
    await sourceProduct.save();

    await addToDestination(
      toType,
      toId,
      productId,
      sourceProduct.name,
      sourceProduct.brand,
      sourceProduct.model,
      sourceProduct.barcode,
      sourceProduct.pricing,
      quantity
    );

    deliveryProducts.push({
      product: productId,
      name: sourceProduct.name,
      brand: sourceProduct.brand,
      model: sourceProduct.model,
      barcode: sourceProduct.barcode,
      pricing: sourceProduct.pricing,
      quantity,
    });
  }

  const delivery = await Delivery.create({
    from: fromId,
    fromType,
    fromName: sourceOutlet.name,
    to: toId,
    toType,
    toName: destOutlet.name,
    products: deliveryProducts,
    sentBy: req.user._id,
    note,
  });

  res.status(201).json({
    status: 'success',
    data: { delivery },
  });
});

// Get all deliveries for an outlet
exports.getDeliveries = catchAsync(async (req, res, next) => {
  const { outletId } = req.params;

  const outlet = await Outlet.findById(outletId).select('owner workers').lean();
  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const isOwner = outlet.owner.equals(req.user._id);
  const isWorker = outlet.workers?.some((w) => w.user.equals(req.user._id));
  if (!isOwner && !isWorker) return next(new AppError('FORBIDDEN', 403));

  const deliveries = await Delivery.find({
    $or: [{ from: outletId }, { to: outletId }],
  })
    .populate('sentBy', 'name')
    .sort('-createdAt')
    .lean();

  res.status(200).json({
    status: 'success',
    results: deliveries.length,
    data: { deliveries },
  });
});

// Get all deliveries for current user
exports.getAllMyDeliveries = catchAsync(async (req, res, next) => {
  const deliveries = await Delivery.find({ sentBy: req.user._id })
    .populate('sentBy', 'name')
    .sort('-createdAt')
    .lean();

  res.status(200).json({
    status: 'success',
    results: deliveries.length,
    data: { deliveries },
  });
});
