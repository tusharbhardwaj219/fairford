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
    type:    String,
    enum:    ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
    index:   true,
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'credit', 'online', 'cash'],
  },
  timeline: [timelineSchema],
  notes: String,
}, { timestamps: true });

orderSchema.pre('save', async function () {
  if (this.orderNumber) return;
  const count = await mongoose.model('Order').countDocuments();
  const pad = String(count + 1).padStart(5, '0');
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  this.orderNumber = `ORD-${ymd}-${pad}`;
});

orderSchema.index({ retailer: 1, createdAt: -1 });
orderSchema.index({ distributor: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
