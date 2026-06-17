const mongoose = require('mongoose');

// ─── Product (catalog) ─────────────────────────────────────

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product must have a name'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    brand: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Product must have a model'],
      trim: true,
    },
    pricing: {
      costPrice: {
        type: Number,
        required: [true, 'Product must have a cost price'],
        min: [0, 'Price cannot be negative'],
        set: (v) => Math.round(v * 100) / 100,
      },
      wholesalePrice: {
        type: Number,
        min: [0, 'Price cannot be negative'],
        set: (v) => Math.round(v * 100) / 100,
      },
      retailPrice: {
        type: Number,
        min: [0, 'Price cannot be negative'],
        set: (v) => Math.round(v * 100) / 100,
      },
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Product must have an owner'],
    },
    barcode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
      required: true
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────

productSchema.index({ owner: 1 });
productSchema.index({ owner: 1, barcode: 1 });
productSchema.index({ name: 'text', model: 'text' }); // text search

module.exports = mongoose.model('Product', productSchema);
