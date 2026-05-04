const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product must have a name'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Product must have a model'],
      trim: true,
    },
    pricing: {
      initialPrice: {
        type: Number,
        required: [true, 'Product must have an initial price'],
        min: [0, 'Price cannot be negative'],
        set: (v) => Math.floor(v),
      },
      bulkPrice: {
        type: Number,
        min: [0, 'Price cannot be negative'],
      },
      retailPrice: {
        type: Number,
        required: [true, 'Product must have a retail price'],
        min: [0, 'Price cannot be negative'],
      },
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Product must have an owner'],
    },
    quantity: {
      type: Number,
      default: 0,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toO: { virtuals: true },
  }
);

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
