const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Warehouse must have a name'],
      trim: true,
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Warehouse must have an owner'],
    },
    workers: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
        name: String,
        permissions: {
          canAddProduct: { type: Boolean, default: false },
          canEditProduct: { type: Boolean, default: false },
          canDeleteProduct: { type: Boolean, default: false },
          canViewIncome: { type: Boolean, default: false },
          canManageWarehouse: { type: Boolean, default: false },
          canViewReports: { type: Boolean, default: false },
          canAssignToMultipleStores: { type: Boolean, default: false },
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
module.exports = Warehouse;
