const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  street:  String,
  city:    String,
  state:   String,
  pincode: String,
}, { _id: false });

const kycDocSchema = new mongoose.Schema({
  type:   { type: String, enum: ['gst', 'drug_license', 'pan', 'address_proof', 'other'] },
  url:    String,
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
}, { _id: false });

const retailerSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, select: false },
  phone:     { type: String, trim: true },
  shopName:  { type: String, trim: true },
  shopAddress: addressSchema,
  gstNumber:          { type: String, trim: true, uppercase: true },
  drugLicenseNumber:  { type: String, trim: true },
  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor',
    default: null,
  },
  status:       { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
  kycDocuments: [kycDocSchema],
  creditLimit: { type: Number, default: 100000 },
  creditUsed:  { type: Number, default: 0 },
  wallet: {
    balance: { type: Number, default: 0 },
  },
  uphaarTier:   { type: String, enum: ['Silver', 'Gold', 'Platinum'], default: 'Silver' },
  uphaarPoints: { type: Number, default: 0 },
  profileImage: {
    url:       { type: String, default: null },
    public_id: { type: String, default: null },
  },
  role:      { type: String, default: 'ret' },
  lastLogin: { type: Date, default: null },
  // Security: Track failed login attempts for brute force protection
  loginAttempts: { type: Number, default: 0 },
  // Lock account until this timestamp (brute force protection)
  lockUntil: { type: Date, default: null },
}, { timestamps: true });

retailerSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

retailerSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

/**
 * Check if account is locked due to failed login attempts
 */
retailerSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * Record a failed login attempt
 * Lock account after 5 failed attempts for 30 minutes
 */
retailerSchema.methods.recordFailedLogin = async function () {
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts
  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  return this.save({ validateBeforeSave: false });
};

/**
 * Reset login attempts on successful login
 */
retailerSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save({ validateBeforeSave: false });
};

retailerSchema.methods.toSafe = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

retailerSchema.virtual('creditAvailable').get(function () {
  return this.creditLimit - this.creditUsed;
});

module.exports = mongoose.model('Retailer', retailerSchema);
