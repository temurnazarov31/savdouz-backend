// controllers/transactionController.js
const Transaction = require('../models/transactionModel');
const DailyReport = require('../models/dailyReportModel');
const StoreProduct = require('../models/storeProductModel');
const WhProduct = require('../models/whProductModel');
const Store = require('../models/storeModel');
const Warehouse = require('../models/warehouseModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createTransaction = catchAsync(async (req, res, next) => {
  const { outletId, products, saleSource, priceType, paymentMethod } = req.body;

  if (!outletId) return next(new AppError('Please provide outlet ID', 400));
  if (!products || products.length === 0)
    return next(new AppError('Please provide at least one product', 400));
  if (!['store', 'warehouse'].includes(saleSource))
    return next(new AppError('Invalid sale source', 400));

  // Check access
  if (saleSource === 'warehouse') {
    const warehouse = await Warehouse.findOne({ _id: outletId });
    if (!warehouse) return next(new AppError('No warehouse found', 404));

    const isOwner = warehouse.owner.equals(req.user._id);
    const isWorker = warehouse.workers?.find((w) =>
      w.user.equals(req.user._id)
    );

    if (!isOwner && !isWorker) return next(new AppError('No permission', 403));
  } else {
    const store = await Store.findOne({ _id: outletId });
    if (!store) return next(new AppError('No store found', 404));
    const isOwner = store.owner.equals(req.user._id);
    const isWorker = store.workers?.find((w) => w.user.equals(req.user._id));

    if (!isOwner && !isWorker) return next(new AppError('No permission', 403));
  }

  const transactionProducts = [];
  let totalAmount = 0;
  let totalProfit = 0;
  let totalQuantity = 0;

  for (const item of products) {
    const { productId, quantity } = item;

    if (!productId) return next(new AppError('Please provide product ID', 400));
    if (!quantity || quantity <= 0)
      return next(new AppError('Invalid quantity', 400));
    let transactedProduct;
    if (saleSource === 'warehouse') {
      transactedProduct = await WhProduct.findOne({
        warehouse: outletId,
        product: productId,
      });
    } else {
      transactedProduct = await StoreProduct.findOne({
        store: outletId,
        product: productId,
      });
    }

    if (!transactedProduct)
      return next(new AppError(`Product not found in ${saleSource}`, 404));
    if (transactedProduct.quantity < quantity) {
      return next(
        new AppError(
          `Not enough stock for ${transactedProduct.name}. Available: ${transactedProduct.quantity}`,
          400
        )
      );
    }

    // Decrease quantity
    transactedProduct.quantity -= quantity;
    await transactedProduct.save();

    const priceAtSale =
      priceType === 'bulk'
        ? transactedProduct.pricing.bulkPrice
        : transactedProduct.pricing.retailPrice;

    const profit = priceAtSale - transactedProduct.pricing.initialPrice;
    const itemTotalAmount = priceAtSale * quantity;
    const itemTotalProfit = profit * quantity;

    transactionProducts.push({
      product: productId,
      name: transactedProduct.name,
      model: transactedProduct.model,
      quantity,
      priceAtSale,
      initialPrice: transactedProduct.pricing.initialPrice,
      profit,
      totalAmount: itemTotalAmount,
      totalProfit: itemTotalProfit,
    });
    totalAmount += itemTotalAmount;
    totalProfit += itemTotalProfit;
    totalQuantity += quantity;
  }

  // Create single transaction with all products
  const transaction = await Transaction.create({
    outlet: outletId,
    products: transactionProducts,
    priceType,
    paymentMethod: req.body.paymentMethod,
    totalAmount,
    totalProfit,
    totalQuantity,
    soldBy: req.user._id,
    saleSource,
    date: new Date().toISOString().split('T')[0],
  });

  // Update daily report
  const today = new Date().toISOString().split('T')[0];
  let report = await DailyReport.findOne({ outlet: outletId, date: today });

  if (!report) {
    report = await DailyReport.create({
      outlet: outletId,
      date: today,
      totalIncome: 0,
      totalProfit: 0,
      totalTransactions: 0,
      transactions: [],
    });
  }

  report.totalIncome += totalAmount;
  report.totalProfit += totalProfit;
  report.totalTransactions += 1;
  report.transactions.push(transaction._id);
  await report.save();

  res.status(201).json({
    status: 'success',
    data: { transaction },
  });
});

// Get all transactions for a store
exports.getStoreTransactions = catchAsync(async (req, res, next) => {
  const outletId = req.params.outletId;
  const store = await Store.findOne({ _id: outletId, owner: req.user._id });
  const warehouse = await Warehouse.findOne({
    _id: outletId,
    owner: req.user._id,
  });

  if (!store && !warehouse) {
    return next(new AppError('You do not have access to this outlet', 403));
  }

  const isStoreOwner = store?.owner?.equals(req.user._id);
  const storeWorker = store?.workers?.find((w) => w.user.equals(req.user._id));
  const isWarehouseOwner = warehouse?.owner?.equals(req.user._id);
  const warehouseWorker = warehouse?.workers?.find((w) =>
    w.user.equals(req.user._id)
  );

  if (!isStoreOwner && !storeWorker && !isWarehouseOwner && !warehouseWorker) {
    return next(
      new AppError('Only the owner or workers can get stoer transactions', 403)
    );
  }

  const transactions = await Transaction.find({
    outlet: req.params.outletId,
  }).exec();

  if (!transactions) {
    return next(new AppError('No transactions yet'), 404);
  }

  return res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: { transactions },
  });
});

// Get daily report for a store
exports.getDailyReport = catchAsync(async (req, res, next) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const transactions = await Transaction.find({
    outlet: req.params.outletId,
    date,
  })
    .populate('soldBy', 'name')
    .sort({ createdAt: -1 });
  const allTransactions = await Transaction.find({}).limit(1);

  const totalIncome = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalProfit = transactions.reduce((sum, t) => sum + t.totalProfit, 0);
  const totalQuantity = transactions.reduce(
    (sum, t) => sum + t.totalQuantity,
    0
  );

  res.status(200).json({
    status: 'success',
    data: {
      date,
      totalIncome,
      totalProfit,
      totalQuantity,
      totalTransactions: transactions.length,
      transactions,
    },
  });
});

// Get income summary (last 7 days, 30 days, custom range)
exports.getIncomeSummary = catchAsync(async (req, res, next) => {
  // ?days=7 or ?days=30 or ?startDate=2026-01-01&endDate=2026-03-18
  const { days, startDate, endDate } = req.query;

  const filter = { outlet: req.params.outletId };

  if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  } else {
    const daysAgo = parseInt(days) || 7;
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    filter.date = { $gte: start.toISOString().split('T')[0] }; // ← add this line
  }

  const reports = await DailyReport.find(filter).sort('date');

  const totalIncome = reports.reduce((sum, r) => sum + r.totalIncome, 0);
  const totalProfit = reports.reduce((sum, r) => sum + r.totalProfit, 0);
  const totalTransactions = reports.reduce(
    (sum, r) => sum + r.totalTransactions,
    0
  );

  res.status(200).json({
    status: 'success',
    data: {
      totalIncome,
      totalProfit,
      totalTransactions,
      dailyBreakdown: reports,
    },
  });
});
