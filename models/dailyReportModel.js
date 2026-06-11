const mongoose = require('mongoose');

// ─── Daily Report ──────────────────────────────────────────

const dailyReportSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.ObjectId,
      ref: 'Outlet',
      required: [true, 'Report must belong to an outlet'],
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    totalIncome: {
      type: Number,
      default: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    totalProfit: {
      type: Number,
      default: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    totalTransactions: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactions: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction',
      },
    ],
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────

dailyReportSchema.index({ outlet: 1, date: -1 });
dailyReportSchema.index({ outlet: 1, date: 1 }, { unique: true }); // one report per outlet per day

module.exports = mongoose.model('DailyReport', dailyReportSchema);