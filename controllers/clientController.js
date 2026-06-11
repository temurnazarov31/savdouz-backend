const Client = require('../models/clientModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

// ─── Helper ────────────────────────────────────────────────

const getOwnerId = (user) => (user.role === 'owner' ? user._id : user.owner);

// ─── CREATE CLIENT ─────────────────────────────────────────
exports.createClient = catchAsync(async (req, res, next) => {
  const { name, phone, initialDebt, note } = req.body;

  if (!name) return next(new AppError('CLIENT_NAME_REQUIRED', 400));

  const ownerId = getOwnerId(req.user);

  if (phone) {
    const existing = await Client.findOne({
      owner: ownerId,
      phone,
    })
      .select('_id')
      .lean();
    if (existing) return next(new AppError('CLIENT_PHONE_EXISTS', 409));
  }

  const client = await Client.create({
    name,
    phone: phone || undefined,
    note: note || undefined,
    owner: ownerId,
    debt: initialDebt || 0,
    recordedBy: req.user._id,
  });

  res.status(201).json({ status: 'success', data: { client } });
});

// ─── GET ALL CLIENTS ───────────────────────────────────────
exports.getAllClients = catchAsync(async (req, res, next) => {
  const ownerId = getOwnerId(req.user);
  const scope = { owner: ownerId };

  if (req.query.debtOnly === 'true') {
    scope.debt = { $gt: 0 };
  }

  // Exclude debtOnly from APIFeatures query
  const { debtOnly, ...restQuery } = req.query;

  const features = new APIFeatures(Client.find(scope), restQuery)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const clients = await features.query;

  res.status(200).json({
    status: 'success',
    results: clients.length,
    data: { clients },
  });
});

// ─── GET ONE CLIENT ────────────────────────────────────────
exports.getClient = catchAsync(async (req, res, next) => {
  const ownerId = getOwnerId(req.user);

  const client = await Client.findOne({
    _id: req.params.id,
    owner: ownerId,
  })
    .populate('paymentHistory.recordedBy', 'name')
    .lean();

  if (!client) return next(new AppError('CLIENT_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { client } });
});

// ─── GET MY CLIENTS ────────────────────────────────────────
exports.getMyClients = catchAsync(async (req, res, next) => {
  const ownerId = await getOwnerId(req.user);

  const clients = await Client.find({
    owner: ownerId,
    recordedBy: req.user._id, 
  })
    .sort('-debt')
    .lean();

  res.status(200).json({
    status: 'success',
    results: clients.length,
    data: { clients },
  });
});

// ─── UPDATE CLIENT ─────────────────────────────────────────
exports.updateClient = catchAsync(async (req, res, next) => {
  const ownerId = await getOwnerId(req.user);
  const { name, phone, note } = req.body; // removed debt

  const client = await Client.findOne({ _id: req.params.id, owner: ownerId });
  if (!client) return next(new AppError('CLIENT_NOT_FOUND', 404));

  if (phone && phone !== client.phone) {
    const existing = await Client.findOne({
      owner: ownerId,
      phone,
      _id: { $ne: req.params.id },
    });
    if (existing) return next(new AppError('CLIENT_PHONE_EXISTS', 409));
  }

  if (name) client.name = name;
  if (phone) client.phone = phone;
  if (note !== undefined) client.note = note;
  await client.save();

  res.status(200).json({ status: 'success', data: { client } });
});

exports.deleteClient = catchAsync(async (req, res, next) => {
  const ownerId = await getOwnerId(req.user);

  const client = await Client.findOne({ _id: req.params.id, owner: ownerId });
  if (!client) return next(new AppError('CLIENT_NOT_FOUND', 404));

  if (client.debt > 0) return next(new AppError('CLIENT_HAS_DEBT', 400));

  await client.deleteOne();

  res.status(204).json({ status: 'success', data: null });
});

// ─── RECORD DEBT PAYMENT ───────────────────────────────────
exports.recordPayment = catchAsync(async (req, res, next) => {
  const ownerId = await getOwnerId(req.user);
  const { amount, method, note } = req.body;

  if (!amount || amount <= 0) return next(new AppError('INVALID_AMOUNT', 400));
  if (!method) return next(new AppError('PAYMENT_METHOD_REQUIRED', 400));

  const client = await Client.findOne({
    _id: req.params.id,
    owner: ownerId,
  });
  
  if (!client) return next(new AppError('CLIENT_NOT_FOUND', 404));

  if (client.debt <= 0) return next(new AppError('NO_DEBT', 400));

  client.debt = Math.max(0, client.debt - amount);

  client.paymentHistory.push({
    amount,
    method,
    note,
    recordedBy: req.user._id,
  });

  await client.save();

  res.status(200).json({
    status: 'success',
    data: { remainingDebt: client.debt },
  });
});

// ─── ADD DEBT (called internally from transaction controller) ─
exports.addDebt = async (clientId, amount) => {
  await Client.findByIdAndUpdate(clientId, {
    $inc: { debt: amount },
  });
};
