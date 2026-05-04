const mongoose = require('mongoose');

const whProductSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Product must have a warehouse'],
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

const WhProduct = mongoose.model('WarehouseProduct', whProductSchema);
module.exports = WhProduct;
