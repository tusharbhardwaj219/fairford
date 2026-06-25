const mongoose = require('mongoose');

const distributorDispatchSchema = new mongoose.Schema({
  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor',
    required: [true, 'Distributor is required'],
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    index: true
  },
  batchNumber: {
    type: String,
    required: [true, 'Batch number is required'],
    trim: true,
    uppercase: true
  },
  quantitySent: {
    type: Number,
    required: [true, 'Quantity sent is required'],
    min: [1, 'Quantity must be at least 1']
  },
  dispatchDate: {
    type: Date,
    required: [true, 'Dispatch date is required'],
    default: Date.now
  },
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    trim: true,
    uppercase: true,
    unique: true
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

// Compound index for efficient per-batch inventory lookups
distributorDispatchSchema.index({ distributor: 1, product: 1, batchNumber: 1 });

module.exports = mongoose.model('DistributorDispatch', distributorDispatchSchema);
