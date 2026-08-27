const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  brand:       String,
  quantity:    { type: Number, required: true, min: 1 },
  unitPrice:   { type: Number, required: true },
  gstRate:     { type: Number, default: 12 },
  totalPrice:  { type: Number, required: true },
}, { _id: true });

const timelineSchema = new mongoose.Schema({
  status:    String,
  note:      String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type:   String,
    unique: true,
  },
  retailer: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Retailer',
    required: true,
  },
  distributor: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Distributor',
    required: true,
  },
  items:    [orderItemSchema],
  subtotal: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'dispatched', 'delivered', 'returned', 'cancelled'],
    default: 'pending',
    index:   true,
  },
  deliveryPriority: {
    type:    String,
    enum:    ['standard', 'express', 'urgent'],
    default: 'standard',
  },
  deliveryAddress: {
    street:  String,
    city:    String,
    state:   String,
    pincode: String,
  },
  expectedDelivery: Date,
  actualDelivery:   Date,
  paymentStatus: {
    // 'failed' = an online payment attempt was made and did not succeed. The
    // order stays visible so the retailer can retry or cancel it.
    type:    String,
    enum:    ['unpaid', 'partial', 'paid', 'failed'],
    default: 'unpaid',
    index:   true,
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'credit', 'online', 'cash'],
  },
  // ── Razorpay (online payment) ───────────────────────────────────────────────
  // Set when the order is paid online. `sparse` so the unique index ignores the
  // many COD orders that never get a Razorpay order.
  razorpayOrderId:   { type: String, default: null, index: true, sparse: true },
  razorpayPaymentId: { type: String, default: null },
  paidAt:            { type: Date,   default: null },
  timeline: [timelineSchema],
  notes: String,
}, { timestamps: true });

// Per-day atomic counter so concurrent orders can't collide on orderNumber.
// countDocuments()+1 was racy: two orders placed at once computed the same
// number, and the unique index then rejected the second with a 500.
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.OrderCounter || mongoose.model('OrderCounter', counterSchema);

orderSchema.pre('save', async function () {
  if (this.orderNumber) return;
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const counter = await Counter.findByIdAndUpdate(
    `order-${ymd}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  this.orderNumber = `ORD-${ymd}-${String(counter.seq).padStart(5, '0')}`;
});

orderSchema.index({ retailer: 1, createdAt: -1 });
orderSchema.index({ distributor: 1, createdAt: -1 });

// ── Uphaar rewards hook ──────────────────────────────────────────────────────
// Flag the transition into 'delivered' while modified-paths are still known
// (isModified is only meaningful pre-save). Plain sync hook WITH next — safe
// per the async-hook gotcha; only async hooks must omit next.
orderSchema.pre('save', function (next) {
  this._becameDelivered = this.isModified('status') && this.status === 'delivered';
  next();
});

// After a delivered order is persisted, credit Uphaar cashback + refresh the
// retailer's box/tier snapshot. Best-effort + idempotent (see rewardsService),
// so it never fails the save. Required lazily to avoid a circular require
// (rewardsService pulls in this model). Fires for EVERY deliver path because
// they all go through order.save() (orderController, adminController,
// distributorInventoryController).
orderSchema.post('save', function (doc) {
  if (!doc || !doc._becameDelivered) return;
  doc._becameDelivered = false;
  const { creditOrderRewards } = require('../services/rewardsService');
  Promise.resolve().then(function () { return creditOrderRewards(doc._id); }).catch(function () {});
});

module.exports = mongoose.model('Order', orderSchema);
