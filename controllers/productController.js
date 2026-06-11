const Product = require('../models/productModel');
const Outlet = require('../models/outletModel');
const APIFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

// ─── Helpers ───────────────────────────────────────────────

const getOwnerId = async (user) => {
  if (user.role !== 'worker') return user._id;
  const outlet = await Outlet.findOne({ 'workers.user': user._id })
    .select('owner')
    .lean();
  return outlet?.owner || null;
};

const assertProductOwner = (product, userId, next) => {
  if (!product.owner.equals(userId)) {
    return next(new AppError('FORBIDDEN', 403));
  }
};

const checkBarcodeDuplicate = async (barcode, excludeId, next) => {
  const existing = await Product.findOne({
    barcode,
    _id: { $ne: excludeId },
  })
    .select('_id')
    .lean();
  if (existing) return next(new AppError('BARCODE_ALREADY_EXISTS', 409));
};

const generateBarcodePng = async (barcode) => {
  return await bwipjs.toBuffer({
    bcid: 'code128',
    text: barcode.toString(),
    scale: 2,
    height: 15,
    includetext: false,
  });
};

// ─── EXPORT SINGLE BARCODE ─────────────────────────────────
// GET /api/v1/products/:id/barcode
exports.exportSingleBarcode = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .select('name model barcode owner')
    .lean();

  if (!product) return next(new AppError('PRODUCT_NOT_FOUND', 404));
  if (!product.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  const doc = new PDFDocument({ margin: 20, size: [200, 150] });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${product.name}-barcode.pdf`
  );
  doc.pipe(res);

  try {
    const png = await generateBarcodePng(product.barcode);
    doc.image(png, 10, 10, { width: 180, height: 70 });
  } catch {
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
    .text(product.barcode.toString(), 10, 113, { width: 180 });

  doc.end();
});

// ─── EXPORT ALL BARCODES ───────────────────────────────────
// GET /api/v1/products/barcodes
exports.exportBarcodes = catchAsync(async (req, res, next) => {
  const ownerId = await getOwnerId(req.user);
  if (!ownerId) return next(new AppError('NOT_ATTACHED_TO_OUTLET', 404));

  const products = await Product.find({ owner: ownerId })
    .select('name model barcode')
    .lean();

  if (!products.length) return next(new AppError('NO_PRODUCTS_FOUND', 404));

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
      const png = await generateBarcodePng(product.barcode);
      doc.image(png, x + 10, y + 10, { width: 140, height: 50 });
    } catch {
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
      .text(product.barcode.toString(), x + 10, y + 90, { width: 150 });
    doc.rect(x, y, cellWidth - 5, cellHeight - 5).stroke();
  }

  doc.end();
});

// ─── GET ALL PRODUCTS ──────────────────────────────────────
// GET /api/v1/products
exports.getAllMyProducts = catchAsync(async (req, res, next) => {
  const ownerId = await getOwnerId(req.user);

  if (!ownerId) {
    return res.status(200).json({
      status: 'success',
      results: 0,
      data: { products: [] },
    });
  }

  const features = new APIFeatures(Product.find({ owner: ownerId }), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query.lean();

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: { products },
  });
});

// ─── GET SINGLE PRODUCT ────────────────────────────────────
// GET /api/v1/products/:id
exports.getMyProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id).lean();

  if (!product) return next(new AppError('PRODUCT_NOT_FOUND', 404));
  if (!product.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  res.status(200).json({ status: 'success', data: { product } });
});

// ─── CREATE PRODUCT ────────────────────────────────────────
// POST /api/v1/products
exports.createProduct = catchAsync(async (req, res, next) => {
  if (req.body.barcode) {
    await checkBarcodeDuplicate(req.body.barcode, null, next);
  }

  const product = await Product.create({ ...req.body, owner: req.user._id });

  res.status(201).json({ status: 'success', data: { product } });
});

// ─── UPDATE PRODUCT ────────────────────────────────────────
// PATCH /api/v1/products/:id
exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id).select('owner').lean();

  if (!product) return next(new AppError('PRODUCT_NOT_FOUND', 404));
  if (!product.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  if (req.body.barcode) {
    await checkBarcodeDuplicate(req.body.barcode, req.params.id, next);
  }

  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).lean();

  res.status(200).json({ status: 'success', data: { product: updated } });
});

// ─── DELETE PRODUCT ────────────────────────────────────────
// DELETE /api/v1/products/:id
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id).select('owner').lean();

  if (!product) return next(new AppError('PRODUCT_NOT_FOUND', 404));
  if (!product.owner.equals(req.user._id))
    return next(new AppError('FORBIDDEN', 403));

  await Product.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});
