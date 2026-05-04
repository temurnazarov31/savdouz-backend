const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.ObjectId,
      ref: 'Store',
      required: [true, 'Product must have a store'],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
    },
    name: {
      type: String,
    },
    model: {
      type: String,
      required: [true, 'Product must have a model'],
      trim: true,
    },
    pricing: {
      initialPrice: Number,
      bulkPrice: Number,
      retailPrice: Number,
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toO: { virtuals: true },
  }
);

const StoreProduct = mongoose.model('StoreProduct', storeProductSchema);
module.exports = StoreProduct;
