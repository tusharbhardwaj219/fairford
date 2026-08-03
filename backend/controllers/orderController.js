const Order   = require('../models/Order');
const Product = require('../models/Product');
const Retailer = require('../models/Retailer');
const { findServiceableDistributor } = require('../services/routingService');
const { sendDistributorOrderNotification } = require('../services/emailService');
const { createRetailerOrder } = require('../services/orderService');

// POST /api/orders — retailer places a new order (cash on delivery)
//
// Validation, distributor routing, server-side pricing and atomic stock
// reservation all live in services/orderService.js, which the Razorpay
// (online payment) flow reuses — one source of truth for the payable amount.
const placeOrder = async (req, res) => {
  try {
    const { items, deliveryPriority, notes } = req.body;

    const result = await createRetailerOrder({
      retailerId: req.user._id,
      items,
      deliveryPriority,
      notes,
      paymentMethod: 'cash',   // pay on delivery
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const { order, retailer, distributor } = result;

    // Notify the assigned distributor/stockist — never block the order on email failure
    sendDistributorOrderNotification(distributor, order, retailer)
      .catch(err => console.warn('[order:notify] distributor email failed:', err.message));

    const populated = await Order.findById(order._id)
      .populate('retailer', 'shopName name shopAddress')
      .populate('distributor', 'businessName name');

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order:   populated,
    });
  } catch (err) {
    console.error('[order:place]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/orders — get orders (role-based)
const getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const pageN  = Math.max(1, Number(req.query.page) || 1);
    const limitN = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};

    if (req.user.role === 'ret') {
      filter.retailer = req.user._id;
    } else if (req.user.role === 'dist') {
      filter.distributor = req.user._id;
    }

    if (status && status !== 'all') {
      filter.status = status.toLowerCase();
    }

    const skip  = (pageN - 1) * limitN;
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate('retailer',    'shopName name shopAddress.city phone')
      .populate('distributor', 'businessName name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitN);

    return res.status(200).json({
      success: true,
      count:   orders.length,
      total,
      pages:   Math.ceil(total / limitN),
      page:    pageN,
      orders,
    });
  } catch (err) {
    console.error('[order:getAll]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('retailer',    'shopName name shopAddress phone email')
      .populate('distributor', 'businessName name businessAddress phone')
      .populate('items.product', 'name brand image');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Guard against a populated ref being null (e.g. the retailer/distributor
    // record was deleted) — dereferencing ._id would otherwise throw a 500.
    const retailerId    = order.retailer    && order.retailer._id    && order.retailer._id.toString();
    const distributorId = order.distributor && order.distributor._id && order.distributor._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isOwner = isAdmin ||
      (req.user.role === 'ret'  && retailerId    === req.user.id) ||
      (req.user.role === 'dist' && distributorId === req.user.id);

    if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error('[order:getById]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/orders/:id/approve — distributor approves order
const approveOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, distributor: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot approve order in '${order.status}' status` });
    }

    order.status = 'approved';
    order.timeline.push({ status: 'approved', note: req.body.note || 'Approved by distributor' });
    await order.save();

    return res.status(200).json({ success: true, message: 'Order approved', order });
  } catch (err) {
    console.error('[order:approve]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/orders/:id/dispatch — distributor dispatches order
const dispatchOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, distributor: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'approved') {
      return res.status(400).json({ success: false, message: `Cannot dispatch order in '${order.status}' status` });
    }

    order.status = 'dispatched';
    order.timeline.push({ status: 'dispatched', note: req.body.note || 'Dispatched by distributor' });
    await order.save();

    return res.status(200).json({ success: true, message: 'Order dispatched', order });
  } catch (err) {
    console.error('[order:dispatch]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/orders/:id/deliver — mark as delivered
const deliverOrder = async (req, res) => {
  try {
    // Scope to the assigned distributor so one distributor can't transition
    // another party's order (was findById with no owner check → IDOR).
    const order = await Order.findOne({ _id: req.params.id, distributor: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'dispatched') {
      return res.status(400).json({ success: false, message: `Cannot deliver order in '${order.status}' status` });
    }

    order.status        = 'delivered';
    order.actualDelivery = new Date();
    order.timeline.push({ status: 'delivered', note: req.body.note || 'Delivered successfully' });
    await order.save();

    return res.status(200).json({ success: true, message: 'Order marked as delivered', order });
  } catch (err) {
    console.error('[order:deliver]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/orders/:id/return — retailer requests a return
const returnOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, retailer: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!['delivered'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Returns only allowed for delivered orders' });
    }

    order.status = 'returned';
    order.timeline.push({ status: 'returned', note: req.body.reason || 'Return requested by retailer' });
    await order.save();

    // Restore central stock (credit/wallet no longer used — cash on delivery)
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }

    return res.status(200).json({ success: true, message: 'Return request submitted', order });
  } catch (err) {
    console.error('[order:return]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/orders/:id/cancel
const cancelOrder = async (req, res) => {
  try {
    // Owner scope lives in the query (no order.retailer.toString() that would
    // throw on a deleted ref). The transition is a single atomic update matched
    // on a cancellable status, so two concurrent cancels can't both win and
    // double-restore stock — only the first matches.
    const ownerFilter =
      req.user.role === 'ret'  ? { retailer:    req.user._id } :
      req.user.role === 'dist' ? { distributor: req.user._id } : null;
    if (!ownerFilter) return res.status(403).json({ success: false, message: 'Access denied' });

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'cancelled' }, $push: { timeline: { status: 'cancelled', note: req.body.reason || 'Cancelled' } } },
      { returnDocument: 'after' }
    );

    if (!order) {
      // Disambiguate: does the caller own an order with this id at all?
      const existing = await Order.findOne({ _id: req.params.id, ...ownerFilter }).select('status');
      if (!existing) return res.status(404).json({ success: false, message: 'Order not found' });
      return res.status(400).json({ success: false, message: `Cannot cancel order in '${existing.status}' status` });
    }

    // Restore central stock (credit/wallet no longer used — cash on delivery)
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }

    return res.status(200).json({ success: true, message: 'Order cancelled', order });
  } catch (err) {
    console.error('[order:cancel]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { placeOrder, getOrders, getOrderById, approveOrder, dispatchOrder, deliverOrder, returnOrder, cancelOrder };
