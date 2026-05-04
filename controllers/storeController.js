// controllers/storeController.js
const Store = require('./../models/storeModel');
const Warehouse = require('../models/warehouseModel');
const StoreProduct = require('./../models/storeProductModel');
const Product = require('./../models/productModel');
const User = require('../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

// Create store — owner only
exports.createStore = catchAsync(async (req, res, next) => {
  const store = await Store.create({
    name: req.body.name,
    owner: req.user._id, // from protect middleware
  });

  await User.findByIdAndUpdate(req.user._id, { role: 'owner' });

  res.status(201).json({
    status: 'success',
    data: { store },
  });
});

// Get all stores owned by current user
exports.getMyStores = catchAsync(async (req, res, next) => {
  const stores = await Store.find({ owner: req.user._id });

  if (!stores) {
    return next(new AppError('You do not have stores ', 404));
  }

  // Get products count for each store
  const storesWithCount = await Promise.all(
    stores.map(async (store) => {
      const productsCount = await StoreProduct.countDocuments({
        store: store._id,
      });
      return { ...store.toObject(), productsCount };
    })
  );

  res.status(200).json({
    status: 'success',
    results: stores.length,
    data: { stores: storesWithCount },
  });
});

// Get single store
exports.getStore = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId).populate({
    path: 'owner',
    select: 'name role',
  });

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  // Only owner or workers can view
  const isOwner = store.owner.equals(req.user._id);
  const isWorker = store.workers.some((w) => w.user._id.equals(req.user._id));

  if (!isOwner && !isWorker) {
    return next(new AppError('You do not have access to this store', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { store },
  });
});

exports.getMyStore = catchAsync(async (req, res, next) => {
  const store = await Store.findOne({ owner: req.user._id });
  const workerStore = await Store.findOne({ 'workers.user': req.user._id });

  const outlet = store || workerStore;
  if (!outlet) {
    res.status(200).json({
    status: 'success',
    data: { store: outlet },
  });
  }

  res.status(200).json({
    status: 'success',
    data: { store: outlet },
  });
});

// Update store — owner only
exports.updateStore = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  if (!store.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can update this store', 403));
  }

  const updatedStore = await Store.findByIdAndUpdate(
    req.params.outletId,
    {
      name: req.body.name,
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: { store: updatedStore },
  });
});

// Delete store — owner only
exports.deleteStore = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  if (!store.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can delete this store', 403));
  }

  await Store.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.addProductToStore = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  if (!store.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can add products', 403));
  }

  const product = await Product.findById(req.body.productId);

  if (!product) {
    return next(new AppError('Product with this ID does not exist', 404));
  }

  if (!product.owner.equals(store.owner)) {
    return next(new AppError('You do not have this kind of product', 404));
  }

  if (!req.body.quantity || req.body.quantity <= 0) {
    return next(new AppError('Invalid quantity', 400));
  }

  const storeProduct = await StoreProduct.findOneAndUpdate(
    {
      store: req.params.outletId,
      product: product._id,
    },
    {
      $inc: { quantity: req.body.quantity },
      $setOnInsert: {
        store: req.params.outletId,
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
    data: storeProduct,
  });
});
