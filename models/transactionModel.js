// models/transactionModel.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      required: [true, 'Transaction must have an outlet'],
    },
    products: [
      {
        product: { type: mongoose.Schema.ObjectId, ref: 'Product' },
        name: String,
        model: String,
        quantity: Number,
        priceType: { type: String, enum: ['bulk', 'retail'] },
        priceAtSale: Number,
        initialPrice: Number,
        profit: Number,
        totalAmount: Number,
        totalProfit: Number,
      },
    ],
    paymentMethod: { type: String, enum: ['naqd', 'karta'], default: 'cash' },
    totalAmount: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    soldBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    saleSource: {
      type: String,
      enum: ['store', 'warehouse'],
      default: 'store',
    },
    date: { type: String },
  },
  { timestamps: true }
);

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
