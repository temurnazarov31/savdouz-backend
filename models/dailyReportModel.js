// models/dailyReportModel.js
const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      ref: 'store warehouse',
      required: [true, 'Report must belong to a store or warehouse'],
    },
    date: {
      type: String, // stored as 'YYYY-MM-DD'
      required: true,
    },
    totalIncome: { type: Number, default: 0 }, // total revenue
    totalProfit: { type: Number, default: 0 }, // actual profit
    totalTransactions: { type: Number, default: 0 },
    transactions: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// One report per store per day
dailyReportSchema.index({ outlet: 1, date: 1 }, { unique: true });

const DailyReport = mongoose.model('DailyReport', dailyReportSchema);
module.exports = DailyReport;
