const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  street: String,
  city:   String,
  state:  String,
  pincode: String,
}, { _id: false });

const kycDocSchema = new mongoose.Schema({
  type:   { type: String, enum: ['gst', 'drug_license', 'pan', 'address_proof', 'other'] },
  url:    String,
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
}, { _id: false });

const distributorSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, select: false },
  phone:        { type: String, trim: true },
  businessName: { type: String, trim: true },
  businessAddress: addressSchema,
  gstNumber:    { type: String, trim: true, uppercase: true },
  drugLicenseNumber: { type: String, trim: true },
  // Serviceable cities (used by the order routing engine as a city-level match)
  territory:    [{ type: String }],
  // Serviceable pincodes (primary key the routing engine matches a retailer's
  // shop pincode against — exact match first, then 3-digit region proximity)
  serviceablePincodes: [{ type: String, trim: true }],
  status:       { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
  kycDocuments: [kycDocSchema],
  wallet: {
    balance:     { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  profileImage: {
    url:      { type: String, default: null },
    public_id: { type: String, default: null },
  },
  role:      { type: String, default: 'dist' },
  lastLogin: { type: Date, default: null },
  // Security: Track failed login attempts for brute force protection
  loginAttempts: { type: Number, default: 0 },
  // Lock account until this timestamp (brute force protection)
  lockUntil: { type: Date, default: null },
}, { timestamps: true });

distributorSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

distributorSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

/**
 * Check if account is locked due to failed login attempts
 */
distributorSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * Record a failed login attempt
 * Lock account after 5 failed attempts for 30 minutes
 */
distributorSchema.methods.recordFailedLogin = async function () {
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
distributorSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save({ validateBeforeSave: false });
};

distributorSchema.methods.toSafe = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Distributor', distributorSchema);
