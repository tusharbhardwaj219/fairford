const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userType: { type: String, enum: ['distributor', 'retailer'], required: true },
  type:     { type: String, enum: ['credit', 'debit'], required: true },
  amount:   { type: Number, required: true, min: 0 },
  balance:  { type: Number, required: true },
  description: { type: String, required: true },
  reference:   { type: mongoose.Schema.Types.ObjectId, default: null },
  referenceType: {
    type: String,
    enum: ['order', 'payment', 'recharge', 'cashback', 'refund'],
    default: null,
  },
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
