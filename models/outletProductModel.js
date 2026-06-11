const mongoose = require('mongoose');

// ─── Outlet Product (per-store inventory) ──────────────────

const outletProductSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Product must belong to an outlet'],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: [true, 'OutletProduct must reference a product'],
    },
    name: {
      type: String,
      required: [true, 'Product must have a name'],
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    pricing: {
      costPrice: {
        type: Number,
        min: [0, 'Cost price cannot be negative'],
        set: (v) => Math.round(v * 100) / 100,
      },
      wholesalePrice: {
        type: Number,
        min: [0, 'Wholesale price cannot be negative'],
        set: (v) => Math.round(v * 100) / 100,
      },
      retailPrice: {
        type: Number,
        min: [0, 'Retail price cannot be negative'],
        set: (v) => Math.round(v * 100) / 100,
      },
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
      set: (v) => Math.floor(v),
    },
    barcode: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────

outletProductSchema.index({ outlet: 1 });
outletProductSchema.index({ outlet: 1, product: 1 }, { unique: true }); // one record per product per outlet
outletProductSchema.index({ outlet: 1, quantity: 1 }); // low-stock queries

module.exports = mongoose.model('OutletProduct', outletProductSchema);
