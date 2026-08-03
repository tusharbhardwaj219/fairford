const crypto           = require('crypto');
const Payment          = require('../models/Payment');
const Order            = require('../models/Order');
const Retailer         = require('../models/Retailer');
const Distributor      = require('../models/Distributor');
const WalletTransaction = require('../models/WalletTransaction');
const razorpayConfig   = require('../config/razorpay');
const { createRetailerOrder } = require('../services/orderService');
const {
  createRazorpayOrder, verifyAndRecordPayment, markPaymentFailed,
} = require('../services/paymentService');
const { verifyWebhookSignature } = require('../utils/verifySignature');
const { sendDistributorOrderNotification } = require('../services/emailService');

// GET /api/payments — payment history (role-based)
const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};

    if (req.user.role === 'ret')  filter.retailer    = req.user._id;
    if (req.user.role === 'dist') filter.distributor = req.user._id;
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate('retailer',    'shopName name')
      .populate('distributor', 'businessName name')
      .populate('order',       'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({ success: true, payments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[payment:history]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/payments/outstanding — unpaid orders for retailer
const getOutstanding = async (req, res) => {
  try {
    if (req.user.role !== 'ret') {
      return res.status(403).json({ success: false, message: 'Only retailers can view outstanding dues' });
    }

    const orders = await Order.find({
      retailer:      req.user._id,
      paymentStatus: { $in: ['unpaid', 'partial'] },
      status:        { $nin: ['cancelled', 'returned'] },
    }).populate('distributor', 'businessName name').sort({ createdAt: -1 });

    const totalOutstanding = orders.reduce((s, o) => s + o.totalAmount, 0);
    const overdueOrders    = orders.filter(o => {
      const days = (Date.now() - o.createdAt) / (1000 * 60 * 60 * 24);
      return days > 15 && o.status === 'delivered';
    });

    return res.status(200).json({
      success: true,
      totalOutstanding,
      overdueAmount: overdueOrders.reduce((s, o) => s + o.totalAmount, 0),
      orders,
    });
  } catch (err) {
    console.error('[payment:outstanding]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/payments — DISABLED (Audit C-1)
// Orders are cash-on-delivery and their paymentStatus is set by staff through the
// admin panel (PUT /api/dist-inventory/orders/:id/payment). A client-initiated
// call must never mutate wallet balance, credit, or an order's paymentStatus —
// doing so let a retailer self-credit and mark their own orders "paid". There is
// no payment gateway wired, so this endpoint is intentionally turned off.
const createPayment = async (_req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Online payments are unavailable. Orders are cash on delivery; payment is confirmed by our team on delivery.',
  });
};

// POST /api/payments/wallet/recharge — DISABLED (Audit C-1)
// Self-crediting the wallet with a client-supplied amount and no gateway was a
// free-balance vulnerability. Re-enable only behind a verified payment provider.
const rechargeWallet = async (_req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Wallet recharge is currently unavailable.',
  });
};

// GET /api/wallet/transactions
const getWalletTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await WalletTransaction.countDocuments({ userId: req.user._id });

    const transactions = await WalletTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({ success: true, transactions, total, page: Number(page) });
  } catch (err) {
    console.error('[payment:transactions]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAZORPAY — Standard Checkout
   Note: `createPayment` above stays disabled on purpose. It let a client name
   its own amount; these endpoints instead price every order on the server.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Notify the assigned distributor once money has actually arrived. */
function notifyDistributor(orderId) {
  Order.findById(orderId)
    .populate('distributor')
    .populate('retailer')
    .then(full => {
      if (!full || !full.distributor) return null;
      return sendDistributorOrderNotification(full.distributor, full, full.retailer);
    })
    .catch(err => console.warn('[payment:notify] distributor email failed:', err.message));
}

// GET /api/payments/config — public key id + whether online pay is enabled.
// The key id is public by design (it ships to the browser). The secret never
// leaves the server through any endpoint.
const getRazorpayConfig = (_req, res) => {
  return res.status(200).json({
    success:  true,
    enabled:  razorpayConfig.isRazorpayConfigured(),
    keyId:    razorpayConfig.getPublicKeyId() || null,
    currency: 'INR',
  });
};

// POST /api/payments/order — create the internal order + a Razorpay order.
// Body: { items: [{ product, quantity }], deliveryPriority?, notes? }
// The payable amount is computed server-side from live product prices; nothing
// the browser sends can change what it is charged.
const createPaymentOrder = async (req, res) => {
  try {
    if (!razorpayConfig.isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Online payment is not available right now. Please choose cash on delivery.',
      });
    }

    const { items, deliveryPriority, notes } = req.body;

    // 1 ── internal pending order (validates, routes, prices, reserves stock)
    const result = await createRetailerOrder({
      retailerId: req.user._id,
      items,
      deliveryPriority,
      notes,
      paymentMethod: 'online',
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const { order, retailer } = result;

    // 2 ── matching Razorpay order
    const rzp = await createRazorpayOrder(order);
    if (!rzp.ok) {
      order.paymentStatus = 'failed';
      order.timeline.push({ status: 'pending', note: 'Could not create payment — gateway unavailable' });
      await order.save();
      return res.status(rzp.status).json({ success: false, message: rzp.message });
    }

    return res.status(201).json({
      success:  true,
      message:  'Payment order created',
      keyId:    razorpayConfig.getPublicKeyId(),
      // Razorpay order (amount is in paise)
      order_id: rzp.rzpOrder.id,
      amount:   rzp.rzpOrder.amount,
      currency: rzp.rzpOrder.currency,
      receipt:  rzp.rzpOrder.receipt,
      // our order
      orderId:      order._id,
      orderNumber:  order.orderNumber,
      amountRupees: order.totalAmount,
      prefill: {
        name:    retailer.shopName || retailer.name || '',
        email:   retailer.email || '',
        contact: retailer.phone || retailer.mobile || '',
      },
    });
  } catch (err) {
    console.error('[payment:create-order]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/payments/verify — verify the Checkout signature and mark the order paid.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const result = await verifyAndRecordPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      retailerId: req.user._id,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    if (!result.alreadyRecorded) notifyDistributor(result.order._id);

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        id:            result.order._id,
        orderNumber:   result.order.orderNumber,
        totalAmount:   result.order.totalAmount,
        paymentStatus: result.order.paymentStatus,
        status:        result.order.status,
      },
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error('[payment:verify]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/payments/failed — record a cancelled or failed attempt.
// Body: { razorpay_order_id, reason? }
const paymentFailed = async (req, res) => {
  try {
    const { razorpay_order_id, reason } = req.body;
    const result = await markPaymentFailed({
      razorpay_order_id,
      reason,
      retailerId: req.user._id,
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.status(200).json({
      success: true,
      message: 'Payment attempt recorded as failed',
      orderNumber: result.order.orderNumber,
    });
  } catch (err) {
    console.error('[payment:failed]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/payments/webhook — server-to-server confirmation.
// Fires even if the customer closes the browser right after paying, so the
// order still gets marked paid. Mounted with a RAW body parser: the HMAC is
// computed over the exact bytes Razorpay sent.
const razorpayWebhook = async (req, res) => {
  try {
    if (!razorpayConfig.getWebhookSecret()) {
      return res.status(503).json({ success: false, message: 'Webhook not configured' });
    }
    if (!verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) {
      console.warn('[payment:webhook] invalid signature — ignored');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(req.body.toString('utf8'));
    const entity  = payload.payload && payload.payload.payment && payload.payload.payment.entity;

    if (payload.event === 'payment.captured' && entity) {
      const order = await Order.findOne({ razorpayOrderId: entity.order_id });
      if (order && order.paymentStatus !== 'paid') {
        // The webhook signature already proved authenticity; recompute the
        // checkout-style HMAC so the shared verification path can be reused.
        const signature = crypto
          .createHmac('sha256', razorpayConfig.getKeySecret())
          .update(`${entity.order_id}|${entity.id}`)
          .digest('hex');
        const r = await verifyAndRecordPayment({
          razorpay_order_id:   entity.order_id,
          razorpay_payment_id: entity.id,
          razorpay_signature:  signature,
        });
        if (r.ok && !r.alreadyRecorded) notifyDistributor(r.order._id);
      }
    } else if (payload.event === 'payment.failed' && entity) {
      await markPaymentFailed({
        razorpay_order_id: entity.order_id,
        reason: entity.error_description || 'payment failed',
      });
    }

    // Always answer 2xx quickly — Razorpay retries on anything else.
    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error('[payment:webhook]', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

module.exports = {
  getPaymentHistory, getOutstanding, createPayment, rechargeWallet, getWalletTransactions,
  // Razorpay
  getRazorpayConfig, createPaymentOrder, verifyPayment, paymentFailed, razorpayWebhook,
};
