const mongoose = require('mongoose');

const distributorReturnSchema = new mongoose.Schema({
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
  quantityReturned: {
    type: Number,
    required: [true, 'Quantity returned is required'],
    min: [1, 'Quantity must be at least 1']
  },
  returnReason: {
    type: String,
    required: [true, 'Return reason is required'],
    enum: ['Damaged', 'Expired', 'Near Expiry', 'Wrong Product', 'Leakage', 'Packaging Damage', 'Other']
  },
  returnDate: {
    type: Date,
    required: [true, 'Return date is required'],
    default: Date.now
  },
  returnStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

distributorReturnSchema.index({ distributor: 1, product: 1, batchNumber: 1 });

module.exports = mongoose.model('DistributorReturn', distributorReturnSchema);
