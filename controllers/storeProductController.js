const Store = require('../models/storeModel');
const StoreProduct = require('./../models/storeProductModel');
const APIFeatures = require('./../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllStoreProducts = catchAsync(async (req, res) => {
  const features = new APIFeatures(StoreProduct.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const storeProducts = await features.query;

  res.status(200).json({
    status: 'success',
    results: storeProducts.length,
    data: { storeProducts },
  });
});

exports.getStoreProducts = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  const isOwner = store.owner.equals(req.user._id);
  const isWorker = store.workers.some((w) => w.user.equals(req.user._id));

  if (!isOwner && !isWorker) {
    return next(new AppError('You do not have access to this store', 403));
  }

  const inventory = await StoreProduct.find({
    store: req.params.outletId,
  }).populate('product', 'name model barcode pricing');

  res.status(200).json({
    status: 'success',
    data: { inventory },
  });
});

exports.getStoreProduct = catchAsync(async (req, res, next) => {
  const storeProduct = await StoreProduct.findById(req.params.id);

  if (!storeProduct) {
    return next(new AppError('No product found with ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: storeProduct,
  });
});

exports.createStoreProduct = catchAsync(async (req, res, next) => {
  const newStoreProduct = await StoreProduct.create({
    ...req.body,
    owner: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      product: newStoreProduct,
    },
  });
});

exports.updateStoreProduct = catchAsync(async (req, res, next) => {
  const storeProduct = await StoreProduct.findById(req.params.id);

  if (!storeProduct) {
    return next(new AppError('No product found with that ID'), 404);
  }

  if (!storeProduct.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can update this product', 403));
  }

  const updatedStoreProduct = await StoreProduct.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      returnDocument: 'after',
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      product: updatedStoreProduct,
    },
  });
});

exports.deleteStoreProduct = catchAsync(async (req, res, next) => {
  const storeProduct = await StoreProduct.findOne({ product: req.params.id });

  if (!storeProduct) {
    return next(new AppError('No product found with that ID'), 404);
  }

  const store = await Store.findOne({
    _id: storeProduct.store,
    owner: req.user._id,
  });
  if (!store) {
    return next(new AppError('You do not have permission', 403));
  }

  const deletedStoreProduct = await StoreProduct.findOneAndDelete(
    req.params.id
  );
  res.status(204).json({
    status: 'success',
    data: null,
  });
});
