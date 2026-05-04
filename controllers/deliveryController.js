// controllers/deliveryController.js
const Delivery = require('../models/deliveryModel');
const Store = require('../models/storeModel');
const Warehouse = require('../models/warehouseModel');
const StoreProduct = require('../models/storeProductModel');
const WhProduct = require('../models/whProductModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Helper to get product from source
const getSourceProduct = async (type, outletId, productId) => {
  if (type === 'warehouse') {
    return await WhProduct.findOne({ warehouse: outletId, product: productId });
  }
  return await StoreProduct.findOne({ store: outletId, product: productId });
};

// Helper to add product to destination
const addToDestination = async (
  type,
  outletId,
  productId,
  name,
  model,
  pricing,
  quantity
) => {
  if (type === 'warehouse') {
    const existing = await WhProduct.findOne({
      warehouse: outletId,
      product: productId,
    });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
    } else {
      await WhProduct.create({
        warehouse: outletId,
        product: productId,
        name,
        model,
        pricing,
        quantity,
      });
    }
  } else {
    const existing = await StoreProduct.findOne({
      store: outletId,
      product: productId,
    });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
    } else {
      await StoreProduct.create({
        store: outletId,
        product: productId,
        name,
        model,
        pricing,
        quantity,
      });
    }
  }
};

// Helper to verify ownership
const verifyOwnership = async (type, outletId, userId) => {
  if (type === 'warehouse') {
    const warehouse = await Warehouse.findById(outletId);
    return warehouse && warehouse.owner.equals(userId);
  }
  const store = await Store.findById(outletId);
  return store && store.owner.equals(userId);
};

// Create delivery
exports.createDelivery = catchAsync(async (req, res, next) => {
  const { fromType, fromId, toType, toId, products, note } = req.body;

  // Validate inputs
  if (!fromType || !fromId || !toType || !toId) {
    return next(new AppError('Please provide source and destination', 400));
  }
  if (
    !['store', 'warehouse'].includes(fromType) ||
    !['store', 'warehouse'].includes(toType)
  ) {
    return next(new AppError('Invalid outlet type', 400));
  }
  if (fromId === toId) {
    return next(new AppError('Source and destination cannot be the same', 400));
  }
  if (!products || products.length === 0) {
    return next(new AppError('Please provide at least one product', 400));
  }

  // Check ownership of both source and destination
  const ownsFrom = await verifyOwnership(fromType, fromId, req.user._id);
  if (!ownsFrom)
    return next(new AppError('You do not have access to source', 403));

  const ownsTo = await verifyOwnership(toType, toId, req.user._id);
  if (!ownsTo)
    return next(new AppError('You do not have access to destination', 403));

  const deliveryProducts = [];

  // Process each product
  for (const item of products) {
    const { productId, quantity } = item;

    if (!quantity || quantity <= 0) {
      return next(new AppError('Invalid quantity', 400));
    }

    // Get product from source
    const sourceProduct = await getSourceProduct(fromType, fromId, productId);

    if (!sourceProduct) {
      return next(new AppError(`Product not found in source`, 404));
    }

    if (sourceProduct.quantity < quantity) {
      return next(
        new AppError(
          `Not enough stock for ${sourceProduct.name}. Available: ${sourceProduct.quantity}`,
          400
        )
      );
    }

    // Decrease from source
    sourceProduct.quantity -= quantity;
    await sourceProduct.save();

    // Add to destination
    await addToDestination(
      toType,
      toId,
      productId,
      sourceProduct.name,
      sourceProduct.model,
      sourceProduct.pricing,
      quantity
    );

    deliveryProducts.push({
      product: productId,
      name: sourceProduct.name,
      model: sourceProduct.model,
      quantity,
    });
  }

  // Create delivery log
  const delivery = await Delivery.create({
    from: fromId,
    fromType,
    to: toId,
    toType,
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
  const outletId = req.params.outletId;
  const store = await Store.findOne({ _id: outletId });
  const warehouse = await Warehouse.findOne({
    _id: outletId,
  });

  if (!store && !warehouse) {
    return next(new AppError('No outlet found or no permission', 403));
  }

  const deliveries = await Delivery.find({
    $or: [{ from: outletId }, { to: outletId }],
  }).sort('-createdAt');

  // Attach names manually
  const allStores = await Store.find().select('name');
  const allWarehouses = await Warehouse.find().select('name');

  const getName = (id, type) => {
    if (type === 'store') {
      return allStores.find((s) => s._id.equals(id))?.name || 'Unknown Store';
    }
    return (
      allWarehouses.find((w) => w._id.equals(id))?.name || 'Unknown Warehouse'
    );
  };

  const deliveriesWithNames = deliveries.map((d) => ({
    ...d.toObject(),
    fromName: getName(d.from, d.fromType),
    toName: getName(d.to, d.toType),
  }));

  res.status(200).json({
    status: 'success',
    results: deliveries.length,
    data: { deliveries: deliveriesWithNames },
  });
});

// Get all deliveries for current user
exports.getAllMyDeliveries = catchAsync(async (req, res, next) => {
  const deliveries = await Delivery.find({
    sentBy: req.user._id,
  }).sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: deliveries.length,
    data: { deliveries },
  });
});
