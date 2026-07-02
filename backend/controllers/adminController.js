/* =====================================================================
   controllers/adminController.js — Admin / ops panel

   Replaces the old distributor & retailer dashboards. The admin:
     • advances the order lifecycle (pending → approved → dispatched → delivered)
     • approves / suspends retailers (KYC gate)
     • manages distributors / stockists and their serviceable areas (routing)
   ===================================================================== */

const crypto      = require('crypto');
const Order       = require('../models/Order');
const Retailer    = require('../models/Retailer');
const Distributor = require('../models/Distributor');
const Product     = require('../models/Product');

// A high-entropy temp password that still satisfies the complexity policy
// (upper + lower + digit + special). ~72 bits of randomness from the tail.
const strongPassword = () => `Ff9@${crypto.randomBytes(12).toString('base64url')}`;

// Accept ["a","b"] or "a, b" → ['a','b']
function toList(v) {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// ── GET /api/admin/metrics ──────────────────────────────────────────────────
const getMetrics = async (req, res) => {
  try {
    const [pending, approved, dispatched, delivered, total, pendingRetailers, activeRetailers, distributors, revenueAgg] =
      await Promise.all([
        Order.countDocuments({ status: 'pending' }),
        Order.countDocuments({ status: 'approved' }),
        Order.countDocuments({ status: 'dispatched' }),
        Order.countDocuments({ status: 'delivered' }),
        Order.countDocuments({}),
        Retailer.countDocuments({ status: 'pending' }),
        Retailer.countDocuments({ status: 'active' }),
        Distributor.countDocuments({}),
        Order.aggregate([
          { $match: { status: { $in: ['dispatched', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
      ]);

    return res.json({
      success: true,
      metrics: {
        orders:      { pending, approved, dispatched, delivered, total },
        retailers:   { pending: pendingRetailers, active: activeRetailers },
        distributors,
        revenue:     revenueAgg[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error('[admin:metrics]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET /api/admin/orders?status= ───────────────────────────────────────────
const listOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('retailer', 'shopName name shopAddress phone')
        .populate('distributor', 'businessName name')
        .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    return res.json({ success: true, total, page: Number(page), orders });
  } catch (err) {
    console.error('[admin:listOrders]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT /api/admin/orders/:id/status  { status, note? } ─────────────────────
const ALLOWED_TRANSITIONS = {
  pending:    ['approved', 'cancelled'],
  approved:   ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
};
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot move order from '${order.status}' to '${status}'` });
    }

    order.status = status;
    order.timeline.push({ status, note: note || `Marked ${status} by admin` });
    if (status === 'delivered') order.actualDelivery = new Date();

    // Cancelling returns the reserved units to central stock
    if (status === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      }
    }

    await order.save();
    return res.json({ success: true, message: `Order ${status}`, order });
  } catch (err) {
    console.error('[admin:updateOrderStatus]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET /api/admin/retailers?status= ────────────────────────────────────────
const listRetailers = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    const retailers = await Retailer.find(filter).select('-password').sort({ createdAt: -1 }).limit(200);
    return res.json({ success: true, retailers });
  } catch (err) {
    console.error('[admin:listRetailers]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT /api/admin/retailers/:id/approve | /suspend ─────────────────────────
const setRetailerStatus = (status) => async (req, res) => {
  try {
    const retailer = await Retailer.findByIdAndUpdate(
      req.params.id, { $set: { status } }, { returnDocument: 'after' }
    ).select('-password');
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });
    return res.json({ success: true, message: `Retailer ${status === 'active' ? 'approved' : 'suspended'}`, retailer });
  } catch (err) {
    console.error('[admin:setRetailerStatus]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET /api/admin/distributors ─────────────────────────────────────────────
const listDistributors = async (req, res) => {
  try {
    const distributors = await Distributor.find().select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, distributors });
  } catch (err) {
    console.error('[admin:listDistributors]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST /api/admin/distributors ────────────────────────────────────────────
const createDistributor = async (req, res) => {
  try {
    const { name, email, phone, businessName, gstNumber, drugLicenseNumber,
            street, city, state, pincode, territory, serviceablePincodes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }
    const exists = await Distributor.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ success: false, message: 'Email is already registered' });

    const tempPassword = strongPassword();
    const distributor = await new Distributor({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: (phone || '').trim(),
      businessName: (businessName || '').trim(),
      businessAddress: { street: street || '', city: city || '', state: state || 'Maharashtra', pincode: pincode || '' },
      gstNumber: (gstNumber || '').trim(),
      drugLicenseNumber: (drugLicenseNumber || '').trim(),
      territory: toList(territory),
      serviceablePincodes: toList(serviceablePincodes),
      status: 'active',
      password: tempPassword,
      role: 'dist',
    }).save();

    return res.status(201).json({
      success: true,
      message: 'Distributor created',
      distributor: distributor.toSafe(),
      tempPassword,
    });
  } catch (err) {
    console.error('[admin:createDistributor]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT /api/admin/distributors/:id ─────────────────────────────────────────
const updateDistributor = async (req, res) => {
  try {
    const b = req.body;
    const updates = {};
    ['name', 'phone', 'businessName', 'gstNumber', 'drugLicenseNumber', 'status'].forEach(f => {
      if (b[f] !== undefined) updates[f] = b[f];
    });
    if (b.territory !== undefined) updates.territory = toList(b.territory);
    if (b.serviceablePincodes !== undefined) updates.serviceablePincodes = toList(b.serviceablePincodes);
    if (b.street !== undefined || b.city !== undefined || b.state !== undefined || b.pincode !== undefined) {
      updates.businessAddress = { street: b.street || '', city: b.city || '', state: b.state || '', pincode: b.pincode || '' };
    }

    const distributor = await Distributor.findByIdAndUpdate(
      req.params.id, { $set: updates }, { returnDocument: 'after', runValidators: true }
    ).select('-password');
    if (!distributor) return res.status(404).json({ success: false, message: 'Distributor not found' });

    return res.json({ success: true, message: 'Distributor updated', distributor });
  } catch (err) {
    console.error('[admin:updateDistributor]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getMetrics,
  listOrders, updateOrderStatus,
  listRetailers,
  approveRetailer: setRetailerStatus('active'),
  suspendRetailer: setRetailerStatus('suspended'),
  listDistributors, createDistributor, updateDistributor,
};
