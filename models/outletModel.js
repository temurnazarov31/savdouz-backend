const mongoose = require('mongoose');

// ─── Worker Subdocument ────────────────────────────────────

const workerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, trim: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Outlet ────────────────────────────────────────────────

const outletSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Outlet must have a name'],
      trim: true,
      maxlength: [50, 'Outlet name must be less than 50 characters'],
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Outlet must have an owner'],
    },
    type: {
      type: String,
      enum: {
        values: ['store', 'warehouse', 'delivery'],
        message: 'INVALID_OUTLET_TYPE',
      },
      required: [true, 'Outlet must have a type'],
    },
    workers: [workerSchema],
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    inviteToken: {
      type: String,
      select: false, 
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────

outletSchema.index({ owner: 1, type: 1 }); // getAllOutlets?type=store
outletSchema.index({ 'workers.user': 1 }); // getMyOutlet, verifyOutletAccess

// ─── Virtuals ──────────────────────────────────────────────

// Only keep if you use .populate('joinRequests') somewhere
// Remove if you always query JoinRequest directly
outletSchema.virtual('joinRequests', {
  ref: 'JoinRequest',
  foreignField: 'outlet',
  localField: '_id',
});

module.exports = mongoose.model('Outlet', outletSchema);
