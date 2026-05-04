const WhProduct = require('./../models/whProductModel');
const APIFeatures = require('./../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllWarehouseProducts = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    WhProduct.find({ warehouse: req.params.id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const whProduct = await features.query;

  res.status(200).json({
    status: 'success',
    results: whProduct.length,
    data: { whProduct },
  });
});

exports.getWarehouseProduct = catchAsync(async (req, res, next) => {
  const whProduct = await WhProduct.findById(req.params.id);

  if (!whProduct) {
    return next(new AppError('No product found with ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: whProduct,
  });
});

exports.createWarehouseProduct = catchAsync(async (req, res, next) => {
  const newWhProduct = await WhProduct.create({
    ...req.body,
    owner: req.user._id,
    warehouse: req.params.warehouseId,
  });

  res.status(201).json({
    status: 'success',
    data: {
      product: newWhProduct,
    },
  });
});

exports.updateWarehouseProduct = catchAsync(async (req, res, next) => {
  const whProduct = await WhProduct.findById(req.params.id);

  if (!whProduct) {
    return next(new AppError('No product found with that ID'), 404);
  }

  if (!whProduct.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can update this product', 403));
  }

  const updatedWhProduct = await WhProduct.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      product: updatedWhProduct,
    },
  });
});

exports.deleteWarehouseProduct = catchAsync(async (req, res) => {
  const whProduct = await WhProduct.findById(req.params.id);

  if (!whProduct) {
    return next(new AppError('No product found with that ID'), 404);
  }

  const warehouse = await Warehouse.findOne({
    _id: whProduct.warehouse,
    owner: req.user._id,
  });

  if (!warehouse) {
    return next(new AppError('You do not have permission', 403));
  }

  const deletedWhProduct = await WhProduct.findByIdAndDelete(req.params.id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
});
