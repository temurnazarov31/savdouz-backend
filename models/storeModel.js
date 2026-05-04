// models/storeModel.js
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Store must have a name'],
      trim: true,
      maxlength: [50, 'Store name must be less than 50 characters'],
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Store must have an owner'],
    },
    workers: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
        name: { type: String },
        permissions: {
          canSellFromMultipleShops: { type: Boolean, default: false },
          canAccessStoresReports: { type: Boolean, default: false },
          canViewIncome: { type: Boolean, default: false },
          canAddEditDeleteProduct: { type: Boolean, default: false },
          canAddEditDeleteOutlet: { type: Boolean, default: false },
          canManageWorkers: { type: Boolean, default: false },
          canAddRemoveOutletProducts: { type: Boolean, default: false },
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

// Virtual populate
storeSchema.virtual('inventory', {
  ref: 'Inventory',
  foreignField: 'store',
  localField: '_id',
});

storeSchema.virtual('joinRequests', {
  ref: 'JoinRequest',
  foreignField: 'store',
  localField: '_id',
});

const Store = mongoose.model('Store', storeSchema);
module.exports = Store;
