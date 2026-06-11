const mongoose = require('mongoose');

// ─── Transaction Product (snapshot) ───────────────────────

const transactionProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    model: { type: String },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      set: (v) => Math.floor(v),
    },
    priceAtSale: {
      type: Number,
      required: true,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    initialPrice: {
      type: Number,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    profit: {
      type: Number,
      set: (v) => Math.round(v * 100) / 100,
    },
    totalAmount: {
      type: Number,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    totalProfit: {
      type: Number,
      set: (v) => Math.round(v * 100) / 100,
    },
  },
  { _id: false }
);

// ─── Transaction ───────────────────────────────────────────

const transactionSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Transaction must have an outlet'],
    },
    products: {
      type: [transactionProductSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'Transaction must have at least one product',
      },
    },
    priceType: {
      type: String,
      enum: { values: ['wholesale', 'retail'], message: 'INVALID_PRICE_TYPE' },
      default: 'retail',
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['naqd', 'karta'],
        message: 'INVALID_PAYMENT_METHOD',
      },
      required: true,
    },
    totalAmount: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    debt: {
      type: Number,
      default: 0,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    client: {
      type: mongoose.Schema.ObjectId,
      ref: 'Client',
      default: null,
    },
    totalProfit: {
      type: Number,
      default: 0,
      required: true,
      set: (v) => Math.round(v * 100) / 100,
    },
    totalQuantity: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      set: (v) => Math.floor(v),
    },
    soldBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    saleSource: {
      type: String,
      enum: { values: ['store', 'warehouse'], message: 'INVALID_SALE_SOURCE' },
      default: 'store',
      required: true,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────

transactionSchema.index({ outlet: 1, createdAt: -1 });
transactionSchema.index({ outlet: 1, soldBy: 1, createdAt: -1 });
transactionSchema.index({ client: 1, createdAt: -1 }); 
transactionSchema.index({ saleSource: 1, outlet: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
