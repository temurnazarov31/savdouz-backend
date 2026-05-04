const crypto = require('crypto');
const mongoose = require('mongoose');

const inviteTokenSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Invite token must belong to a store'],
    },
    token: {
      type: String,
      unique: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Invite token must have a creator'],
    },
  },
  {
    timestamps: true,
  }
);

// Auto generate token before saving
inviteTokenSchema.pre('save', function (next) {
  if (!this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
});

const InviteToken = mongoose.model('InviteToken', inviteTokenSchema);
module.exports = InviteToken;
