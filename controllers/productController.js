const Product = require('./../models/productModel');
const Store = require('../models/storeModel');
const Warehouse = require('../models/warehouseModel');
const APIFeatures = require('./../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');
const AppError = require('../utils/appError');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

exports.exportSingleBarcode = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) return next(new AppError('No product found', 404));

  const PDFDocument = require('pdfkit');
  const bwipjs = require('bwip-js');

  const doc = new PDFDocument({ margin: 20, size: [200, 150] });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${product.name}-barcode.pdf`
  );
  doc.pipe(res);

  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: product._id.toString(),
      scale: 2,
      height: 15,
      includetext: false,
    });
    doc.image(png, 10, 10, { width: 180, height: 70 });
  } catch (e) {
    doc.rect(10, 10, 180, 70).stroke();
  }

  doc.fontSize(10).text(product.name, 10, 85, { width: 180 });
  doc
    .fontSize(8)
    .fillColor('gray')
    .text(product.model, 10, 100, { width: 180 });
  doc
    .fontSize(7)
    .fillColor('black')
    .text(product._id.toString(), 10, 113, { width: 180 });

  doc.end();
});

exports.exportBarcodes = catchAsync(async (req, res, next) => {
  let products;

  if (req.user.role === 'worker') {
    const store = await Store.findOne({ 'workers.user': req.user._id });
    const warehouse = await Warehouse.findOne({ 'workers.user': req.user._id });
    const outlet = store || warehouse
    if (!outlet) return next(new AppError('No store found', 404));
    products = await Product.find({ owner: outlet.owner });
  } else {
    products = await Product.find({ owner: req.user._id });
  }

  if (!products) {
    return next(new AppError('No products found', 404));
  }

  const doc = new PDFDocument({ margin: 20, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=barcodes.pdf');
  doc.pipe(res);

  const cols = 3;
  const cellWidth = 170;
  const cellHeight = 120;
  const marginLeft = 20;
  const marginTop = 20;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const col = i % cols;
    const row = Math.floor((i % (cols * 7)) / cols);

    if (i > 0 && i % (cols * 7) === 0) doc.addPage();

    const x = marginLeft + col * cellWidth;
    const y = marginTop + row * cellHeight;

    try {
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: product._id.toString(),
        scale: 2,
        height: 15,
        includetext: false,
      });
      doc.image(png, x + 10, y + 10, { width: 140, height: 50 });
    } catch (e) {
      doc.rect(x + 10, y + 10, 140, 50).stroke();
    }

    doc.fontSize(8).text(product.name, x + 10, y + 65, { width: 150 });
    doc
      .fontSize(7)
      .fillColor('gray')
      .text(product.model, x + 10, y + 78, { width: 150 });
    doc
      .fontSize(7)
      .fillColor('black')
      .text(product._id.toString(), x + 10, y + 90, { width: 150 });

    doc.rect(x, y, cellWidth - 5, cellHeight - 5).stroke();
  }

  doc.end();
});

exports.getAllMyProducts = catchAsync(async (req, res, next) => {
  let roleProducts;
  if (req.user.role === 'worker') {
    const store = await Store.findOne({ 'workers.user': req.user._id });
    const warehouse = await Warehouse.findOne({ 'workers.user': req.user._id });

    const outlet = store || warehouse
    if (!outlet)
      return res
        .status(200)
        .json({ status: 'success', results: 0, data: { products: [] } });
    roleProducts = Product.find({ owner: outlet.owner });
  } else {
    roleProducts = Product.find({ owner: req.user._id });
  }

  if (!roleProducts) {
    return next(new AppError('No products yet'));
  }

  const features = new APIFeatures(roleProducts, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const products = await features.query;

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: { products },
  });
});

exports.getMyProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('No product found with ID', 404));
  }

  if (!product.owner.equals(req.user._id)) {
    return next(new AppError('Your do not own the product', 404));
  }

  res.status(200).json({
    status: 'success',
    data: product,
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  const newProduct = await Product.create({ ...req.body, owner: req.user._id });

  res.status(201).json({
    status: 'success',
    data: {
      product: newProduct,
    },
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('No product found with that ID'), 404);
  }
  if (!product.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can update this product', 403));
  }

  const updatedProduct = await Product.findByIdAndUpdate(
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
      product: updatedProduct,
    },
  });
});

exports.deleteProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('No product found with that ID'), 404);
  }

  if (!product.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can update this product'), 403);
  }

  const deletedProduct = await Product.findByIdAndDelete(req.params.id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
});
