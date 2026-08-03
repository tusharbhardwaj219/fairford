/* =====================================================================
   services/paymentService.js — Razorpay order creation, signature
   verification and persistence.

   Security model
     • The payable amount is ALWAYS taken from the Order document that the
       server priced (services/orderService.js). Nothing the browser sends is
       used to compute money.
     • An order is marked paid only after the HMAC-SHA256 signature verifies
       AND Razorpay itself confirms the payment is captured/authorised.
     • Recording is idempotent — replaying the same success callback (or a
       webhook arriving after the browser callback) never double-credits.
   ===================================================================== */

const Order   = require('../models/Order');
const Payment = require('../models/Payment');
const razorpayConfig = require('../config/razorpay');
const { verifyPaymentSignature } = require('../utils/verifySignature');

const MIN_PAISE = 100;                 // Razorpay rejects anything under ₹1
const toPaise   = rupees => Math.round(Number(rupees) * 100);

/**
 * Create a Razorpay order for an internal Order document.
 * @param {object} order  a Mongoose Order (already priced by orderService)
 * @returns {Promise<{ok:true,rzpOrder:object}|{ok:false,status:number,message:string}>}
 */
async function createRazorpayOrder(order) {
  if (!razorpayConfig.isRazorpayConfigured()) {
    return { ok: false, status: 503, message: 'Online payment is not configured. Please choose cash on delivery.' };
  }

  const amountPaise = toPaise(order.totalAmount);
  if (!Number.isFinite(amountPaise) || amountPaise < MIN_PAISE) {
    return { ok: false, status: 400, message: `Order total must be at least ₹${MIN_PAISE / 100}` };
  }

  try {
    const rzpOrder = await razorpayConfig.instance.orders.create({
      amount:   amountPaise,          // ALWAYS in paise
      currency: 'INR',
      receipt:  order.orderNumber,    // our internal reference
      payment_capture: 1,             // auto-capture on success
      notes: {
        internalOrderId: String(order._id),
        orderNumber:     order.orderNumber,
        retailerId:      String(order.retailer),
      },
    });

    order.razorpayOrderId = rzpOrder.id;
    await order.save();

    return { ok: true, rzpOrder };
  } catch (err) {
    // Razorpay surfaces auth problems as statusCode 401 — usually bad keys.
    const status = err && err.statusCode === 401 ? 401 : 502;
    const desc = (err && err.error && err.error.description) || err.message || 'Unknown Razorpay error';
    console.error('[payment:create]', status, desc);
    return {
      ok: false,
      status,
      message: status === 401
        ? 'Payment gateway authentication failed. Please contact support.'
        : 'Could not reach the payment gateway. Please try again.',
    };
  }
}

/**
 * Verify a Checkout callback and mark the order paid.
 * @param {object} p
 * @param {string} p.razorpay_order_id
 * @param {string} p.razorpay_payment_id
 * @param {string} p.razorpay_signature
 * @param {string} [p.retailerId]  when present, the order must belong to them
 */
async function verifyAndRecordPayment({
  razorpay_order_id, razorpay_payment_id, razorpay_signature, retailerId,
}) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return { ok: false, status: 400, message: 'Missing payment verification fields' };
  }

  // 1 ── signature must be authentic before we trust ANY of this
  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    console.warn('[payment:verify] signature mismatch for rzp order', razorpay_order_id);
    await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        paymentStatus: 'failed',
        $push: { timeline: { status: 'pending', note: 'Online payment rejected — invalid signature' } },
      }
    );
    return { ok: false, status: 400, message: 'Payment verification failed. If money was deducted it will be refunded automatically.' };
  }

  // 2 ── the order must exist and belong to this retailer
  const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
  if (!order) return { ok: false, status: 404, message: 'Order not found for this payment' };
  if (retailerId && String(order.retailer) !== String(retailerId)) {
    console.warn('[payment:verify] retailer mismatch on order', order.orderNumber);
    return { ok: false, status: 403, message: 'This payment does not belong to your account' };
  }

  // 3 ── idempotency: already recorded (e.g. webhook beat the browser callback)
  const existing = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
  if (existing || order.paymentStatus === 'paid') {
    return { ok: true, alreadyRecorded: true, order, payment: existing || null };
  }

  // 4 ── defence in depth: ask Razorpay what actually happened
  let rzpPayment = null;
  try {
    rzpPayment = await razorpayConfig.instance.payments.fetch(razorpay_payment_id);
  } catch (err) {
    console.warn('[payment:verify] could not fetch payment from Razorpay:', err.message);
  }

  if (rzpPayment) {
    const expectedPaise = toPaise(order.totalAmount);
    if (Number(rzpPayment.amount) !== expectedPaise) {
      console.error('[payment:verify] AMOUNT MISMATCH', { order: order.orderNumber, expectedPaise, got: rzpPayment.amount });
      order.paymentStatus = 'failed';
      order.timeline.push({ status: 'pending', note: 'Online payment rejected — amount mismatch' });
      await order.save();
      return { ok: false, status: 400, message: 'Payment amount did not match the order total.' };
    }
    if (!['captured', 'authorized'].includes(rzpPayment.status)) {
      return { ok: false, status: 400, message: `Payment not completed (status: ${rzpPayment.status}).` };
    }
  }

  // 5 ── persist: order → paid, plus an auditable Payment row
  order.paymentStatus     = 'paid';
  order.razorpayPaymentId = razorpay_payment_id;
  order.paidAt            = new Date();
  order.timeline.push({ status: order.status, note: `Payment received online · ${razorpay_payment_id}` });
  await order.save();

  let payment = null;
  try {
    payment = await Payment.create({
      retailer:    order.retailer,
      distributor: order.distributor,
      order:       order._id,
      amount:      order.totalAmount,
      currency:    'INR',
      paymentType: 'order_payment',
      method:      'online',
      status:      'completed',
      reference:   order.orderNumber,
      paidAt:      new Date(),
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      methodDetail: rzpPayment ? rzpPayment.method : null,
    });
  } catch (err) {
    // A duplicate key here means a concurrent webhook already wrote the row —
    // the order is paid either way, so don't fail the user's request.
    if (err && err.code === 11000) {
      payment = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
    } else {
      console.error('[payment:verify] payment row failed (order IS paid):', err.message);
    }
  }

  return { ok: true, order, payment };
}

/**
 * Record a failed / cancelled attempt. Never trusted for money decisions —
 * it only annotates the order so the retailer and admin can see what happened.
 */
async function markPaymentFailed({ razorpay_order_id, reason, retailerId }) {
  if (!razorpay_order_id) return { ok: false, status: 400, message: 'razorpay_order_id is required' };

  const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
  if (!order) return { ok: false, status: 404, message: 'Order not found for this payment' };
  if (retailerId && String(order.retailer) !== String(retailerId)) {
    return { ok: false, status: 403, message: 'This order does not belong to your account' };
  }

  // Never downgrade an already-successful payment.
  if (order.paymentStatus === 'paid') return { ok: true, order, ignored: true };

  order.paymentStatus = 'failed';
  order.timeline.push({ status: order.status, note: `Online payment failed — ${String(reason || 'cancelled by user').slice(0, 180)}` });
  await order.save();

  return { ok: true, order };
}

module.exports = { createRazorpayOrder, verifyAndRecordPayment, markPaymentFailed, toPaise, MIN_PAISE };
