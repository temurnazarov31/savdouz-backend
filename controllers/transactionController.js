const Transaction = require('../models/transactionModel');
const DailyReport = require('../models/dailyReportModel');
const Outlet = require('../models/outletModel');
const OutletProduct = require('../models/outletProductModel');
const Client = require('../models/clientModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { addDebt } = require('./clientController');

// ─── Helpers ───────────────────────────────────────────────

const getOwnerId = (user) => (user.role === 'owner' ? user._id : user.owner);

const verifyOutletAccess = async (outletId, userId, next) => {
  const outlet = await Outlet.findById(outletId).select('owner workers').lean();
  if (!outlet) return next(new AppError('OUTLET_NOT_FOUND', 404));

  const isOwner = outlet.owner.equals(userId);
  const isWorker = outlet.workers?.some((w) => w.user.equals(userId));
  if (!isOwner && !isWorker) return next(new AppError('FORBIDDEN', 403));

  return outlet;
};

const getOrCreateDailyReport = async (outletId, today) => {
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
  return report;
};

// ─── CREATE TRANSACTION ────────────────────────────────────
// POST /api/v1/transactions
exports.createTransaction = catchAsync(async (req, res, next) => {
  const {
    clientId,
    newClient,
    outletId,
    products,
    saleSource,
    priceType,
    paymentMethod,
    debt,
    discount,
  } = req.body;

  // Validations
  if (!outletId) return next(new AppError('OUTLET_ID_REQUIRED', 400));
  if (!products?.length) return next(new AppError('PRODUCTS_REQUIRED', 400));
  if (!['store', 'warehouse'].includes(saleSource))
    return next(new AppError('INVALID_SALE_SOURCE', 400));

  // Verify outlet access (single query for both store and warehouse)
  const outlet = await verifyOutletAccess(outletId, req.user._id, next);
  if (!outlet) return; // verifyOutletAccess already called next()

  // Process products
  const transactionProducts = [];
  let totalAmount = 0;
  let totalProfit = 0;
  let totalQuantity = 0;

  for (const item of products) {
    const { productId, quantity } = item;

    if (!productId) return next(new AppError('PRODUCT_ID_REQUIRED', 400));
    if (!quantity || quantity <= 0)
      return next(new AppError('INVALID_QUANTITY', 400));

    const transactedProduct = await OutletProduct.findOne({
      outlet: outletId,
      product: productId,
    });

    if (!transactedProduct)
      return next(new AppError('PRODUCT_NOT_IN_OUTLET', 404));
    if (transactedProduct.quantity < quantity) {
      return next(new AppError('INSUFFICIENT_STOCK', 400));
    }

    transactedProduct.quantity -= quantity;
    await transactedProduct.save();

    const priceAtSale =
      priceType === 'wholesale'
        ? transactedProduct.pricing.wholesalePrice
        : transactedProduct.pricing.retailPrice;

    const profit = priceAtSale - transactedProduct.pricing.costPrice;
    const itemTotalAmount = priceAtSale * quantity;
    const itemTotalProfit = profit * quantity;

    transactionProducts.push({
      product: productId,
      name: transactedProduct.name,
      model: transactedProduct.model,
      quantity,
      priceAtSale,
      initialPrice: transactedProduct.pricing.costPrice,
      profit,
      totalAmount: itemTotalAmount,
      totalProfit: itemTotalProfit,
    });

    totalAmount += itemTotalAmount;
    totalProfit += itemTotalProfit;
    totalQuantity += quantity;
  }

  // Apply discount
  const discountAmount = discount ? Math.min(Number(discount), totalAmount) : 0;
  if (discountAmount > 0) {
    totalProfit = Math.max(0, totalProfit - discountAmount);
  }

  const paidAmount = totalAmount - discountAmount - (Number(debt) || 0);

  // Resolve client
  let resolvedClientId = clientId || null;

  if (!clientId && newClient?.name) {
    const client = await Client.create({
      name: newClient.name,
      phone: newClient.phone || undefined,
      note: newClient.note || undefined,
      owner: getOwnerId(req.user),
      debt: Number(debt) || 0,
    });
    resolvedClientId = client._id;
  } else if (clientId && Number(debt) > 0) {
    await addDebt(clientId, Number(debt));
  }

  // Create transaction
  const today = new Date().toISOString().split('T')[0];
  const transaction = await Transaction.create({
    outlet: outletId,
    products: transactionProducts,
    priceType,
    paymentMethod,
    totalAmount,
    paidAmount,
    debt: Number(debt) || 0,
    discount: discountAmount,
    client: resolvedClientId,
    totalProfit,
    totalQuantity,
    soldBy: req.user._id,
    saleSource,
    date: today,
  });

  // Update daily report
  const report = await getOrCreateDailyReport(outletId, today);
  report.totalIncome += paidAmount;
  report.totalProfit += totalProfit;
  report.totalTransactions += 1;
  report.transactions.push(transaction._id);
  await report.save();

  res.status(201).json({ status: 'success', data: { transaction } });
});

// ─── GET ALL TRANSACTIONS ──────────────────────────────────
// GET /api/v1/transactions
exports.getAllTransactions = catchAsync(async (req, res, next) => {
  const { startDate, endDate, outletId, clientId } = req.query;
  const filter = {};

  // Client filter — early return
  if (clientId) {
    filter.client = clientId;
    const transactions = await Transaction.find(filter)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({
      status: 'success',
      results: transactions.length,
      data: { transactions },
    });
  }

  // Outlet filter
  if (outletId) {
    filter.outlet = outletId;
  } else {
    // Get all accessible outlets in one query
    const isWorker = req.user.role === 'worker';

    const outlets = isWorker
      ? await Outlet.find({ 'workers.user': req.user._id }).select('_id').lean()
      : await Outlet.find({ owner: req.user._id }).select('_id').lean();

    filter.outlet = { $in: outlets.map((o) => o._id) };
  }

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)
      filter.createdAt.$lte = new Date(
        new Date(endDate).setHours(23, 59, 59, 999)
      );
  }

  const transactions = await Transaction.find(filter)
    .populate('soldBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: { transactions },
  });
});

// ─── GET OUTLET TRANSACTIONS ───────────────────────────────
// GET /api/v1/transactions/outlet/:outletId
exports.getStoreTransactions = catchAsync(async (req, res, next) => {
  const outlet = await verifyOutletAccess(
    req.params.outletId,
    req.user._id,
    next
  );
  if (!outlet) return;

  const transactions = await Transaction.find({ outlet: req.params.outletId })
    .populate('client', 'name debt')
    .populate('soldBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: { transactions },
  });
});

// ─── GET DAILY REPORT ──────────────────────────────────────
// GET /api/v1/transactions/outlet/:outletId/daily?date=2026-05-01
exports.getDailyReport = catchAsync(async (req, res, next) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const transactions = await Transaction.find({
    outlet: req.params.outletId,
    date,
  })
    .populate('soldBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

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

// ─── GET INCOME SUMMARY ────────────────────────────────────
// GET /api/v1/transactions/outlet/:outletId/summary?days=7
exports.getIncomeSummary = catchAsync(async (req, res, next) => {
  const { days, startDate, endDate } = req.query;
  const filter = { outlet: req.params.outletId };

  if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  } else {
    const daysAgo = parseInt(days) || 7;
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    filter.date = { $gte: start.toISOString().split('T')[0] };
  }

  const reports = await DailyReport.find(filter).sort('date').lean();

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
