const mongoose = require('mongoose');

// ─── Payment History ───────────────────────────────────────

const paymentHistorySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be positive'],
      set: (v) => Math.round(v * 100) / 100,
    },
    method: {
      type: String,
      enum: { values: ['cash', 'card'], message: 'INVALID_PAYMENT_METHOD' },
      required: [true, 'Payment method is required'],
    },
    note: { type: String, trim: true },
    recordedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true, _id: true }
);

// ─── Client ────────────────────────────────────────────────

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'CLIENT_NAME_REQUIRED'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    debt: {
      type: Number,
      default: 0,
      set: (v) => Math.round(v * 100) / 100, // prevent floating point issues
    },
    paymentHistory: [paymentHistorySchema],
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────

clientSchema.index({ owner: 1 });
clientSchema.index({ owner: 1, debt: -1 }); // biggest debtors first
clientSchema.index({ owner: 1, phone: 1 }); // phone lookup + duplicate check

module.exports = mongoose.model('Client', clientSchema);
