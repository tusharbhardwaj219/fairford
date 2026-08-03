/* =====================================================================
   services/orderService.js — single source of truth for creating a retailer
   order (validation → distributor routing → server-side pricing → atomic
   stock reservation → Order document).

   Both checkout paths call this:
     • Cash on delivery  → controllers/orderController.placeOrder
     • Online (Razorpay) → controllers/paymentController.createPaymentOrder

   Keeping it here is what guarantees the payable amount is ALWAYS computed on
   the server from live product prices — the browser never gets to influence it.

   Returns a result object (never throws for expected business failures) so the
   caller can map it straight onto an HTTP status:
     { ok: true,  order, retailer, distributor }
     { ok: false, status, message }
   ===================================================================== */

const Order    = require('../models/Order');
const Product  = require('../models/Product');
const Retailer = require('../models/Retailer');
const { findServiceableDistributor } = require('./routingService');

/** Give back stock that was reserved for an order (used on rollback/cancel). */
async function restoreStock(items = []) {
  for (const it of items) {
    await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.quantity } });
  }
}

/**
 * Validate, price and create a pending order for a retailer.
 *
 * @param {object}  p
 * @param {string}  p.retailerId        req.user._id
 * @param {Array}   p.items             [{ product, quantity }]
 * @param {string} [p.deliveryPriority] standard | express | urgent
 * @param {string} [p.notes]
 * @param {'cash'|'online'} [p.paymentMethod='cash']
 * @param {boolean} [p.skipDuplicateGuard=false]
 */
async function createRetailerOrder({
  retailerId,
  items,
  deliveryPriority,
  notes,
  paymentMethod = 'cash',
  skipDuplicateGuard = false,
}) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, message: 'Order must contain at least one item' };
  }

  const retailer = await Retailer.findById(retailerId);
  if (!retailer) return { ok: false, status: 404, message: 'Retailer not found' };
  if (retailer.status !== 'active') {
    return { ok: false, status: 403, message: 'Account not active. Please complete KYC.' };
  }

  // Orders are routed to the nearest serviceable distributor/stockist using the
  // retailer's shop address, so we need at least a pincode or a city.
  const shopAddr = retailer.shopAddress || {};
  if (!shopAddr.pincode && !shopAddr.city) {
    return { ok: false, status: 400, message: 'Please set your shop address (pincode/city) before ordering.' };
  }

  const distributor = await findServiceableDistributor({ pincode: shopAddr.pincode, city: shopAddr.city });
  if (!distributor) {
    return {
      ok: false,
      status: 422,
      message: 'Your area is not serviceable yet — no distributor covers your pincode/city. Please contact support.',
    };
  }

  // ── Server-side pricing ─────────────────────────────────────────────────────
  const orderItems = [];
  let subtotal  = 0;
  let gstAmount = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false, status: 400, message: 'Every item needs a quantity of at least 1' };
    }

    const product = await Product.findById(item.product || item._id);
    if (!product) return { ok: false, status: 404, message: `Product not found: ${item.product}` };
    if (product.stock < quantity) {
      return { ok: false, status: 400, message: `Insufficient stock for ${product.name}` };
    }

    const unitPrice  = product.retailerPrice;   // price comes from the DB, never the client
    const totalPrice = unitPrice * quantity;
    const gstRate    = product.gst || 12;
    subtotal  += totalPrice;
    gstAmount += (totalPrice * gstRate) / 100;  // per-item GST (5/12/18), not a flat 12%

    orderItems.push({
      product:     product._id,
      productName: product.name,
      brand:       product.brand,
      quantity,
      unitPrice,
      gstRate,
      totalPrice,
    });
  }

  gstAmount = Math.round(gstAmount);
  const totalAmount = subtotal + gstAmount;

  if (!(totalAmount > 0)) {
    return { ok: false, status: 400, message: 'Order total must be greater than zero' };
  }

  // Guard against accidental double-submits — reject an identical order (same
  // products & quantities) from the same retailer within a short window.
  if (!skipDuplicateGuard) {
    const sig = orderItems.map(i => `${i.product}:${i.quantity}`).sort().join('|');
    const recentOrders = await Order.find({
      retailer:  retailer._id,
      createdAt: { $gte: new Date(Date.now() - 30000) },
    }).select('items').lean();
    const isDuplicate = recentOrders.some(o =>
      (o.items || []).map(i => `${i.product}:${i.quantity}`).sort().join('|') === sig
    );
    if (isDuplicate) {
      return {
        ok: false,
        status: 409,
        message: 'This looks like a duplicate of an order you just placed. Check your order history before retrying.',
      };
    }
  }

  // Decrement stock atomically (match-on-stock + $inc in one op) so two
  // concurrent orders can't oversell. Roll back whatever was taken on failure.
  const decremented = [];
  for (const item of orderItems) {
    const upd = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { returnDocument: 'after' }
    );
    if (!upd) {
      await restoreStock(decremented);
      return { ok: false, status: 400, message: `Insufficient stock for ${item.productName}` };
    }
    decremented.push(item);
  }

  const daysMap = { standard: 3, express: 1, urgent: 0 };
  const days = daysMap[deliveryPriority] ?? 3;
  const expectedDelivery = new Date();
  expectedDelivery.setDate(expectedDelivery.getDate() + days);

  const isOnline = paymentMethod === 'online';

  let order;
  try {
    order = await Order.create({
      retailer:    retailer._id,
      distributor: distributor._id,
      items:       orderItems,
      subtotal,
      gstAmount,
      totalAmount,
      deliveryPriority: deliveryPriority || 'standard',
      deliveryAddress:  retailer.shopAddress,
      expectedDelivery,
      paymentMethod: isOnline ? 'online' : 'cash',
      paymentStatus: 'unpaid',
      notes,
      timeline: [{
        status: 'pending',
        note: isOnline
          ? `Order created · awaiting online payment · routed to ${distributor.businessName || distributor.name}`
          : `Order placed by retailer · routed to ${distributor.businessName || distributor.name}`,
      }],
    });
  } catch (createErr) {
    // Order creation failed after stock was taken — give it back.
    await restoreStock(decremented);
    throw createErr;
  }

  return { ok: true, order, retailer, distributor };
}

module.exports = { createRetailerOrder, restoreStock };
