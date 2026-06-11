const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── User ──────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: [true, 'User must have a username'],
      trim: true,
      lowercase: true,
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    name: {
      type: String,
      required: [true, 'User must have a name'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    surname: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // Note: removed lowercase — phone numbers shouldn't be lowercased
    },
    password: {
      type: String,
      required: [true, 'User must have a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: 'PASSWORDS_DO_NOT_MATCH',
      },
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'worker', 'owner', 'admin'],
        message: 'INVALID_ROLE',
      },
      default: 'user',
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: undefined, // don't store null — field simply absent for non-workers
    },
    passwordChangedAt: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verification: {
      code: { type: String, select: false }, // hashed OTP — never expose
      expiresAt: Date,
      attempts: { type: Number, default: 0 },
      lastSentAt: Date,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────

userSchema.index({ owner: 1, role: 1 }); // getAllWorkers query

// ─── Middleware ────────────────────────────────────────────

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
});

// Update passwordChangedAt when password is modified
userSchema.pre('save', function () {
  if (!this.isModified('password') || this.isNew) return;
  this.passwordChangedAt = Date.now() - 1000; // -1s to ensure JWT issued af
});

// Exclude inactive users from all find queries
userSchema.pre(/^find/, function () {
  this.find({ active: { $ne: false } });
});

// ─── Instance Methods ──────────────────────────────────────

userSchema.methods.correctPassword = async function (candidate, hashed) {
  return await bcrypt.compare(candidate, hashed);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.generateOTP = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { code, hashed, expiresAt };
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
