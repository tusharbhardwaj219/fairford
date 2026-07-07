/* =====================================================================
   models/Admin.js — Admin User Schema
   Stores admin user credentials with hashed passwords
   ===================================================================== */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide admin name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide email'],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Please provide password'],
      // Admins are the most privileged accounts — hold them to at least the
      // same 12-char minimum enforced for retailers (was 6).
      minlength: [12, 'Password must be at least 12 characters'],
      select: false // Don't return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'superadmin'],
      default: 'admin'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: null
    },
    // Security: Track failed login attempts for brute force protection
    loginAttempts: {
      type: Number,
      default: 0
    },
    // Lock account until this timestamp (brute force protection)
    lockUntil: {
      type: Date,
      default: null
    },
    // Password reset — stores a hashed token + expiry (never the raw token)
    resetPasswordToken:  { type: String, default: null, select: false },
    resetPasswordExpire: { type: Date,   default: null, select: false }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
adminSchema.pre('save', async function () {
  // Only hash if password is modified
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Method to compare password
 */
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Check if account is locked due to failed login attempts
 * @returns {boolean} true if account is locked
 */
adminSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * Record a failed login attempt
 * Lock account after 5 failed attempts for 30 minutes
 */
adminSchema.methods.recordFailedLogin = async function () {
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts
  if (this.loginAttempts >= 5) {
    // Lock for 30 minutes
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
  }

  return this.save({ validateBeforeSave: false });
};

/**
 * Reset login attempts on successful login
 */
adminSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('Admin', adminSchema);