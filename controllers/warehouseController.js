// controllers/warehouseController.js
const User = require('../models/userModel');
const Store = require('../models/storeModel');
const Warehouse = require('../models/warehouseModel');
const Product = require('../models/productModel');
const StoreProduct = require('../models/storeProductModel');
const WhProduct = require('../models/whProductModel');
const Delivery = require('../models/deliveryModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

async function ownerWarehouse(userId) {
  const store = await Store.findOne({ 'workers.user': userId });
  const warehouse = await Warehouse.findOne({ 'workers.user': userId });

  const outlet = store || warehouse;
  if (!outlet) {
    return next(new AppError('You are not attached to store', 404));
  }

  const ownerWarehouse = await Warehouse.find({ owner: outlet.owner });

  return ownerWarehouse || {};
}

// Create warehouse
exports.createWarehouse = catchAsync(async (req, res, next) => {
  const warehouse = await Warehouse.create({
    name: req.body.name,
    owner: req.user._id,
  });

  await User.findByIdAndUpdate(req.user._id, { role: 'owner' });

  res.status(201).json({
    status: 'success',
    data: { warehouse },
  });
});

// Get my warehouses
exports.getMyWarehouses = catchAsync(async (req, res, next) => {
  const warehouses = await Warehouse.find({
    owner: req.user._id,
  });

  if (!warehouses) {
    return next(new AppError('You do not have warehouses ', 404));
  }

  const warehousesWithCount = await Promise.all(
    warehouses.map(async (warehouse) => {
      const productsCount = await WhProduct.countDocuments({
        warehouse: warehouse._id,
      });
      return { ...warehouse.toObject(), productsCount };
    })
  );

  res.status(200).json({
    status: 'success',
    results: warehouses.length,
    data: { warehouses: warehousesWithCount },
  });
});

// Get single warehouse
exports.getWarehouse = catchAsync(async (req, res, next) => {
  const warehouse = await Warehouse.findById(req.params.id).populate({
    path: 'owner',
    select: 'name role',
  });

  if (!warehouse) {
    return next(new AppError('No store found with that ID', 404));
  }

  // Only owner or workers can view
  const isOwner = warehouse.owner.equals(req.user._id);
  const isWorker = warehouse.workers.some((w) =>
    w.user._id.equals(req.user._id)
  );

  if (!isOwner && !isWorker) {
    return next(new AppError('You do not have access to this store', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { warehouse },
  });
});

exports.getMyWarehouse = catchAsync(async (req, res, next) => {
  const warehouse = await Warehouse.findOne({ owner: req.user._id });
  const workerWarehouse = await Warehouse.findOne({
    'workers.user': req.user._id,
  });

  const outlet = warehouse || workerWarehouse;
  if (!outlet) {
    res.status(200).json({
      status: 'success',
      data: { warehouse: null },
    });
  }

  res.status(200).json({
    status: 'success',
    data: { warehouse: outlet },
  });
});

// Update warehouse — owner only
exports.updateWarehouse = catchAsync(async (req, res, next) => {
  const warehouse = await Warehouse.findById(req.params.id);

  if (!warehouse) {
    return next(new AppError('No store found with that ID', 404));
  }

  if (!warehouse.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can update this store', 403));
  }

  const updatedWarehouse = await Warehouse.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: { warehouse: updatedWarehouse },
  });
});

// Delete warehouse — owner only
exports.deleteWarehouse = catchAsync(async (req, res, next) => {
  const warehouse = await Warehouse.findById(req.params.id);

  if (!warehouse) {
    return next(new AppError('No store found with that ID', 404));
  }

  if (!warehouse.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can delete this store', 403));
  }

  await Warehouse.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Add products to warehouse
exports.addProductToWarehouse = catchAsync(async (req, res, next) => {
  const warehouse = await Warehouse.findById(req.params.id);

  if (!warehouse) {
    return next(new AppError('No warehouse found with that ID', 404));
  }

  if (!warehouse.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can add products', 403));
  }

  const product = await Product.findById(req.body.productId);

  if (!product) {
    return next(new AppError('Product with this ID does not exist', 404));
  }

  if (!req.body.quantity || req.body.quantity <= 0) {
    return next(new AppError('Invalid quantity', 400));
  }

  const whProduct = await WhProduct.findOneAndUpdate(
    {
      warehouse: req.params.id,
      product: product._id,
    },
    {
      $inc: { quantity: req.body.quantity },
      $setOnInsert: {
        warehouse: req.params.id,
        product: product._id,
        name: product.name,
        model: product.model,
        pricing: product.pricing,
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: whProduct,
  });
});

// Get store inventory
exports.getStoreInventory = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.storeId);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  const isOwner = store.owner.equals(req.user._id);
  const isWorker = store.workers.some((w) => w.user.equals(req.user._id));

  if (!isOwner && !isWorker) {
    return next(new AppError('You do not have access to this store', 403));
  }

  const inventory = await StoreProduct.find({
    store: req.params.storeId,
  });

  res.status(200).json({
    status: 'success',
    data: { inventory },
  });
});
