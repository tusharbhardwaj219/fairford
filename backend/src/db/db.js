// ============ USER MODEL ============
const userSchema = require('mongoose').Schema({
  firstname: { type: String, required: true, trim: true },
  lastname: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    match: /.+\@.+\..+/ 
  },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { 
    type: String, 
    enum: ['distributor', 'retailer', 'admin'], 
    default: 'retailer' 
  },
  company: { type: String, trim: true },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  gstin: { type: String, unique: true, sparse: true },
  licenseNo: { type: String, unique: true, sparse: true },
  creditLimit: { type: Number, default: 0 },
  avatar: { type: String, default: null },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  resetToken: String,
  resetTokenExpiry: Date,
  lastLogin: Date,
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============ PRODUCT MODEL ============
const productSchema = require('mongoose').Schema({
  productId: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true },
  composition: String,
  category: { type: String, required: true },
  manufacturer: String,
  packSize: String,
  mrp: { type: Number, required: true },
  netPrice: { type: Number, required: true },
  distributorPrice: Number,
  minOrderQty: { type: Number, default: 1 },
  scheme: String,
  schedule: String,
  stock: { type: Number, default: 0 },
  description: String,
  images: [String],
  sku: { type: String, unique: true, required: true },
  hsn: String,
  gst: { type: Number, default: 0 },
  expiryDate: Date,
  batchNo: String,
  isActive: { type: Boolean, default: true },
  tags: [String],
  ratings: { type: Number, default: 0, min: 0, max: 5 },
  reviews: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============ CART MODEL ============
const cartSchema = require('mongoose').Schema({
  userId: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    productId: { type: require('mongoose').Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtTime: Number,
    addedAt: { type: Date, default: Date.now }
  }],
  totalAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============ ORDER MODEL ============
const orderSchema = require('mongoose').Schema({
  orderId: { type: String, unique: true, required: true },
  userId: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    productId: { type: require('mongoose').Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantity: Number,
    pricePerUnit: Number,
    total: Number,
    gst: Number
  }],
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  subtotal: { type: Number, required: true },
  gstAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { 
    type: String, 
    enum: ['credit', 'debit', 'bank_transfer', 'cheque', 'upi'], 
    required: true 
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  orderStatus: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  trackingNumber: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============ NEWSLETTER SUBSCRIBER MODEL ============
const newsletterSchema = require('mongoose').Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    match: /.+\@.+\..+/ 
  },
  name: String,
  userType: { type: String, enum: ['distributor', 'retailer', 'general'], default: 'general' },
  isActive: { type: Boolean, default: true },
  subscriptionDate: { type: Date, default: Date.now },
  lastEmailSent: Date,
  unsubscribeToken: String,
  unsubscribedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  userSchema,
  productSchema,
  cartSchema,
  orderSchema,
  newsletterSchema
};
