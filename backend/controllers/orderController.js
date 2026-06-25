const Order   = require('../models/Order');
const Product = require('../models/Product');
const Retailer = require('../models/Retailer');
const { findServiceableDistributor } = require('../services/routingService');
const { sendDistributorOrderNotification } = require('../services/emailService');

// POST /api/orders — retailer places a new order
const placeOrder = async (req, res) => {
  try {
    const { items, deliveryPriority, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
    }

    const retailer = await Retailer.findById(req.user._id);
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });
    if (retailer.status !== 'active') return res.status(403).json({ success: false, message: 'Account not active. Please complete KYC.' });

    // The order is routed to the nearest serviceable distributor/stockist by
    // the retailer's shop address. Need at least a pincode or city to route.
    const shopAddr = retailer.shopAddress || {};
    if (!shopAddr.pincode && !shopAddr.city) {
      return res.status(400).json({ success: false, message: 'Please set your shop address (pincode/city) before ordering.' });
    }

    const distributor = await findServiceableDistributor({ pincode: shopAddr.pincode, city: shopAddr.city });
    if (!distributor) {
      return res.status(422).json({
        success: false,
        message: 'Your area is not serviceable yet — no distributor covers your pincode/city. Please contact support.',
      });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product || item._id);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }

      const unitPrice  = product.retailerPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        product:     product._id,
        productName: product.name,
        brand:       product.brand,
        quantity:    item.quantity,
        unitPrice,
        gstRate:     product.gst || 12,
        totalPrice,
      });
    }

    const gstAmount  = Math.round(subtotal * 0.12);
    const totalAmount = subtotal + gstAmount;

    const daysMap = { standard: 3, express: 1, urgent: 0 };
    const days = daysMap[deliveryPriority] ?? 3;
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + days);

    const order = await Order.create({
      retailer:     retailer._id,
      distributor:  distributor._id,
      items:        orderItems,
      subtotal,
      gstAmount,
      totalAmount,
      deliveryPriority: deliveryPriority || 'standard',
      deliveryAddress:  retailer.shopAddress,
      expectedDelivery,
      paymentMethod: 'cash',   // pay on delivery
      paymentStatus: 'unpaid',
      notes,
      timeline: [{ status: 'pending', note: `Order placed by retailer · routed to ${distributor.businessName || distributor.name}` }],
    });

    // Central stock decrement (company inventory; distributor handles delivery)
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
    }

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
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'ret') {
      filter.retailer = req.user._id;
    } else if (req.user.role === 'dist') {
      filter.distributor = req.user._id;
    }

    if (status && status !== 'all') {
      filter.status = status.toLowerCase();
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate('retailer',    'shopName name shopAddress.city')
      .populate('distributor', 'businessName name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      count:   orders.length,
      total,
      pages:   Math.ceil(total / Number(limit)),
      page:    Number(page),
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

    const isOwner =
      (req.user.role === 'ret'  && order.retailer._id.toString()    === req.user.id) ||
      (req.user.role === 'dist' && order.distributor._id.toString() === req.user.id);

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
    const order = await Order.findById(req.params.id);
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
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const isOwner =
      (req.user.role === 'ret'  && order.retailer.toString()    === req.user.id) ||
      (req.user.role === 'dist' && order.distributor.toString() === req.user.id);

    if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

    if (!['pending', 'approved'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel order in '${order.status}' status` });
    }

    order.status = 'cancelled';
    order.timeline.push({ status: 'cancelled', note: req.body.reason || 'Cancelled' });
    await order.save();

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
