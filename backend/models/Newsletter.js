const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    name: {
      type: String,
      trim: true,
      default: null
    },
    userType: {
      type: String,
      enum: ['general', 'retailer', 'distributor', 'doctor'],
      default: 'general'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    subscriptionDate: {
      type: Date,
      default: Date.now
    },
    unsubscribedAt: {
      type: Date,
      default: null
    },
    lastEmailSent: {
      type: Date,
      default: null
    },
    unsubscribeToken: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Newsletter', newsletterSchema);
