const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Join request must belong to a store'],
    },
    worker: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Join request must have a worker'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    inviteToken: {
      type: mongoose.Schema.ObjectId,
      ref: 'InviteToken',
    },
  },
  {
    timestamps: true,
  }
);

const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);
module.exports = JoinRequest;
