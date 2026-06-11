// models/deliveryModel.js
const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Delivery must have a source'],
    },
    fromType: {
      type: String,
      enum: ['store', 'warehouse'],
      required: [true, 'Delivery must have a source type'],
    },
    fromName: { type: String },
    to: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Delivery must have a destination'],
    },
    toType: {
      type: String,
      enum: ['store', 'warehouse'],
      required: [true, 'Delivery must have a destination type'],
    },
    toName: { type: String },
    products: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: 'Product',
        },
        name: String,
        model: String,
        quantity: Number,
      },
    ],
    sentBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'cancelled'],
      default: 'delivered',
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
  },
  { timestamps: true }
);

const Delivery = mongoose.model('Delivery', deliverySchema);
module.exports = Delivery;
