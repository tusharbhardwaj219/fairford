const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Retailer',
    required: true,
  },
  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Distributor',
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Order',
    default: null,
  },
  amount: { type: Number, required: true, min: 0 },
  paymentType: {
    type: String,
    enum: ['order_payment', 'wallet_recharge', 'credit_adjustment', 'refund'],
    required: true,
  },
  method: {
    type: String,
    enum: ['wallet', 'bank_transfer', 'cash', 'cheque', 'online'],
    required: true,
  },
  status: {
    type:    String,
    enum:    ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index:   true,
  },
  reference:  String,
  dueDate:    Date,
  paidAt:     Date,
  notes:      String,
}, { timestamps: true });

paymentSchema.index({ retailer: 1, createdAt: -1 });
paymentSchema.index({ distributor: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
