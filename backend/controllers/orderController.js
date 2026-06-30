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
    let gstAmount = 0;

    for (const item of items) {
      const product = await Product.findById(item.product || item._id);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }

      const unitPrice  = product.retailerPrice;
      const totalPrice = unitPrice * item.quantity;
      const gstRate    = product.gst || 12;
      subtotal  += totalPrice;
      gstAmount += (totalPrice * gstRate) / 100;   // per-item GST (5/12/18), not a flat 12%

      orderItems.push({
        product:     product._id,
        productName: product.name,
        brand:       product.brand,
        quantity:    item.quantity,
        unitPrice,
        gstRate,
        totalPrice,
      });
    }

    gstAmount = Math.round(gstAmount);
    const totalAmount = subtotal + gstAmount;

    // M-1: guard against accidental double-submits — reject an identical order
    // (same products & quantities) from the same retailer within a short window.
    const sig = orderItems.map(i => `${i.product}:${i.quantity}`).sort().join('|');
    const recentOrders = await Order.find({
      retailer:  retailer._id,
      createdAt: { $gte: new Date(Date.now() - 30000) },
    }).select('items').lean();
    const isDuplicate = recentOrders.some(o =>
      (o.items || []).map(i => `${i.product}:${i.quantity}`).sort().join('|') === sig
    );
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'This looks like a duplicate of an order you just placed. Check your order history before retrying.',
      });
    }

    // M-2: decrement stock atomically (match-on-stock + $inc in one op) so two
    // concurrent orders can't oversell or push stock negative. Roll back the
    // items already taken if any line can't be satisfied.
    const decremented = [];
    for (const item of orderItems) {
      const upd = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { returnDocument: 'after' }
      );
      if (!upd) {
        for (const d of decremented) {
          await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.quantity } });
        }
        return res.status(400).json({ success: false, message: `Insufficient stock for ${item.productName}` });
      }
      decremented.push(item);
    }

    const daysMap = { standard: 3, express: 1, urgent: 0 };
    const days = daysMap[deliveryPriority] ?? 3;
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + days);

    let order;
    try {
      order = await Order.create({
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
    } catch (createErr) {
      // Order creation failed after stock was taken — give it back.
      for (const d of decremented) {
        await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.quantity } });
      }
      throw createErr;
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
      .populate('retailer',    'shopName name shopAddress.city')
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
