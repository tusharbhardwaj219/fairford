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

  // ── Razorpay (online payments) ──────────────────────────────────────────────
  // Populated only for method: 'online'. razorpayPaymentId is unique+sparse so
  // the same payment can never be recorded twice (idempotent verification), while
  // the many non-Razorpay payment rows (cash/wallet) are ignored by the index.
  currency:          { type: String, default: 'INR' },
  razorpayOrderId:   { type: String, default: null, index: true, sparse: true },
  razorpayPaymentId: { type: String, default: null, unique: true, sparse: true },
  razorpaySignature: { type: String, default: null, select: false },
  // Instrument reported by Razorpay: card / upi / netbanking / wallet / emi.
  methodDetail:      { type: String, default: null },
  failureReason:     { type: String, default: null },
}, { timestamps: true });

paymentSchema.index({ retailer: 1, createdAt: -1 });
paymentSchema.index({ distributor: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
