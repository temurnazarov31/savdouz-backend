const crypto = require('crypto');
const InviteToken = require('../models/inviteTokenModel');
const JoinRequest = require('../models/joinRequestModel');
const Store = require('../models/storeModel');
const Warehouse = require('../models/warehouseModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Owner generates QR code
exports.generateInvite = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);
  const warehouse = await Warehouse.findById(req.params.outletId);

  const outlet = store || warehouse;
  if (!outlet) return next(new AppError('No outlet found', 404));

  // Only owner can generate invite
  if (!outlet.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can generate an invite', 403));
  }

  // Create invite token
  const invite = await InviteToken.create({
    outlet: req.params.outletId,
    createdBy: req.user._id,
  });
  let inviteUrl;

  // This URL will be encoded into QR code on frontend
  if (store) {
    inviteUrl = `${req.protocol}://${req.get('host')}/api/v1/stores/join/${
      invite.token
    }`;
  } else {
    inviteUrl = `${req.protocol}://${req.get('host')}/api/v1/warehouses/join/${
      invite.token
    }`;
  }

  res.status(201).json({
    status: 'success',
    data: {
      token: invite.token,
      inviteUrl, // frontend encodes this into QR code
    },
  });
});

// Worker scans QR code → sends join request
exports.joinOutlet = catchAsync(async (req, res, next) => {
  const invite = await InviteToken.findOne({
    token: req.params.token,
    isUsed: false,
  });

  if (!invite) {
    return next(new AppError('Invalid or already used invite link', 400));
  }

  // Check if worker already sent a request or is already in store
  const existingRequest = await JoinRequest.findOne({
    outlet: invite.outlet,
    worker: req.user._id,
    status: 'pending',
  });

  if (existingRequest) {
    return next(
      new AppError('You already have a pending request for this store', 400)
    );
  }

  const store = await Store.findById(invite.outlet);
  const warehouse = await Warehouse.findById(invite.outlet);

  const alreadyWorker = store
    ? store.workers.some((w) => w.user.equals(req.user._id))
    : warehouse.workers.some((w) => w.user.equals(req.user._id));

  if (alreadyWorker) {
    return next(new AppError('You are already a worker in this store', 400));
  }

  // Create join request
  const joinRequest = await JoinRequest.create({
    outlet: invite.outlet,
    worker: req.user._id,
    inviteToken: invite._id,
  });

  // Mark token as used
  invite.isUsed = true;
  await invite.save();

  res.status(201).json({
    status: 'success',
    message: 'Join request sent! Waiting for owner approval.',
    data: { joinRequest },
  });
});

// Owner sees all pending requests
exports.getJoinRequests = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);
  const warehouse = await Warehouse.findById(req.params.outletId);
  const outlet = store || warehouse;
  if (!outlet) return next(new AppError('No outlet found', 404));

  // Only owner can generate invite
  if (!outlet.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can generate an invite', 403));
  }

  const requests = await JoinRequest.find({
    outlet: req.params.outletId,
    status: 'pending',
  }).populate('worker', 'name email phone');

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: { requests },
  });
});

// Owner approves or rejects request
exports.handleJoinRequest = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);
  const warehouse = await Warehouse.findById(req.params.outletId);

  const outlet = store || warehouse;
  if (!outlet) return next(new AppError('No outlet found', 404));

  // Only owner can generate invite
  if (!outlet.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can generate an invite', 403));
  }

  const joinRequest = await JoinRequest.findOne({
    _id: req.params.reqId,
  });

  if (!joinRequest || joinRequest.status !== 'pending') {
    return next(new AppError('No pending request found', 404));
  }

  const { action, permissions } = req.body; // action: 'approve' or 'reject'

  if (action === 'approve') {
    const user = await User.findByIdAndUpdate(joinRequest.worker, {
      role: 'worker',
    });

    outlet.workers.push({
      user: joinRequest.worker,
      name: user.name,
      permissions: permissions || {},
    });
    await outlet.save();

    joinRequest.status = 'approved';
    await joinRequest.save();

    return res.status(200).json({
      status: 'success',
      message: 'Worker approved and added',
    });
  }

  if (action === 'reject') {
    joinRequest.status = 'rejected';
    await joinRequest.save();

    return res.status(200).json({
      status: 'success',
      message: 'Join request rejected',
    });
  }

  return next(new AppError('Action must be approve or reject', 400));
});

// Owner removes worker from store
exports.removeWorker = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);
  const warehouse = await Warehouse.findById(req.params.outletId);

  const outlet = store || warehouse;
  if (!outlet) return next(new AppError('No outlet found', 404));

  // Only owner can generate invite
  if (!outlet.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can generate an invite', 403));
  }

  outlet.workers = outlet.workers.filter(
    (w) => !w.user.equals(req.params.workerId)
  );
  await outlet.save();

  res.status(200).json({
    status: 'success',
    message: 'Worker removed',
  });
});

// Owner updates worker permissions
exports.updateWorkerPermissions = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.outletId);
  const warehouse = await Warehouse.findById(req.params.outletId);

  const outlet = store || warehouse;
  if (!outlet) return next(new AppError('No outlet found', 404));

  // Only owner can generate invite
  if (!outlet.owner.equals(req.user._id)) {
    return next(new AppError('Only the owner can generate an invite', 403));
  }

  const worker = outlet.workers.find((w) => w.user.equals(req.params.workerId));
  if (!worker) return next(new AppError('No worker found', 404));

  worker.permissions = {
    ...worker.permissions.toObject(),
    ...req.body.permissions,
  };
  await outlet.save();

  res.status(200).json({
    status: 'success',
    message: 'Permissions updated',
    data: { worker },
  });
});