/* =====================================================================
   rewardsService.js — Fair Ford Pharmaceuticals · Uphaar rewards + wallet
   ---------------------------------------------------------------------
   Everything here is derived from REAL order data — nothing is fabricated:

   • Uphaar progress  = the sum of item quantities ("boxes") across a
     retailer's delivered orders. The reward slabs themselves live in the
     frontend (js/uphaar.js RETAILER_SCHEMES, transcribed from the
     "Retailer Box Scheme 2026-27" PDF); this service only reports the
     retailer's real cumulative box count + spend so the UI can place them
     on those slabs.

   • Wallet cashback  = credited when an order is delivered, and ONLY if an
     admin has created an active, retailer-eligible cashback Scheme that the
     order qualifies for. No scheme ⇒ no cashback (balance stays 0). The
     credit is idempotent per order, so re-delivering or the hook firing
     twice never double-credits.

   The credit path is intentionally best-effort: it must NEVER throw into
   the order-save flow (a rewards hiccup must not fail a delivery).
   ===================================================================== */
'use strict';

const Order             = require('../models/Order');
const Retailer          = require('../models/Retailer');
const Scheme            = require('../models/Scheme');
const WalletTransaction = require('../models/WalletTransaction');

// Orders in these states count as "earned" for rewards + box progress.
const QUALIFYING_STATUSES = ['delivered'];

/**
 * Aggregate a retailer's real, delivered orders into reward metrics.
 * @returns {Promise<{totalBoxes:number,totalSpend:number,orderCount:number,firstOrderAt:Date|null,lastOrderAt:Date|null}>}
 */
async function getRetailerRewardSummary(retailerId) {
  const rows = await Order.aggregate([
    { $match: { retailer: toObjectId(retailerId), status: { $in: QUALIFYING_STATUSES } } },
    { $project: {
        boxes: { $sum: '$items.quantity' },
        totalAmount: 1,
        createdAt: 1,
      } },
    { $group: {
        _id: null,
        totalBoxes:  { $sum: '$boxes' },
        totalSpend:  { $sum: '$totalAmount' },
        orderCount:  { $sum: 1 },
        firstOrderAt:{ $min: '$createdAt' },
        lastOrderAt: { $max: '$createdAt' },
      } },
  ]);
  const r = rows[0] || {};
  return {
    totalBoxes:   r.totalBoxes  || 0,
    totalSpend:   r.totalSpend  || 0,
    orderCount:   r.orderCount  || 0,
    firstOrderAt: r.firstOrderAt || null,
    lastOrderAt:  r.lastOrderAt  || null,
  };
}

/**
 * Find the single best active cashback scheme an order qualifies for.
 * Returns { scheme, cashback } or null. Only the best scheme is applied
 * (schemes are not stacked) so a retailer is never over-credited.
 */
async function bestCashbackForOrder(order, retailer) {
  const now = new Date();
  const schemes = await Scheme.find({
    isActive: true,
    schemeType: 'cashback',
    eligibleFor: { $in: ['retailer', 'both'] },
    validFrom: { $lte: now },
    validTo:   { $gte: now },
    minOrderValue: { $lte: order.totalAmount },
  });

  let best = null;
  for (const s of schemes) {
    // Tier gate: an empty eligibleTiers list means "all tiers".
    if (Array.isArray(s.eligibleTiers) && s.eligibleTiers.length &&
        !s.eligibleTiers.includes(retailer.uphaarTier)) continue;

    let cashback = (order.totalAmount * (s.cashbackPercentage || 0)) / 100;
    if (s.maxCashback != null) cashback = Math.min(cashback, s.maxCashback);
    cashback = Math.round(cashback * 100) / 100;
    if (cashback > 0 && (!best || cashback > best.cashback)) best = { scheme: s, cashback };
  }
  return best;
}

/**
 * Credit rewards for a single delivered order. Idempotent + best-effort.
 * Safe to call from an Order post-save hook or any deliver controller.
 */
async function creditOrderRewards(orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.status !== 'delivered') return;

    // Idempotency: one cashback transaction per order, ever.
    const already = await WalletTransaction.findOne({ reference: order._id, referenceType: 'cashback' }).select('_id');
    if (already) return;

    const retailer = await Retailer.findById(order.retailer);
    if (!retailer) return;

    // 1) Wallet cashback — only if an admin cashback scheme qualifies.
    const best = await bestCashbackForOrder(order, retailer);
    if (best && best.cashback > 0) {
      const newBalance = Math.round(((retailer.wallet?.balance || 0) + best.cashback) * 100) / 100;
      retailer.wallet = retailer.wallet || {};
      retailer.wallet.balance = newBalance;
      await WalletTransaction.create({
        userId: retailer._id,
        userType: 'retailer',
        type: 'credit',
        amount: best.cashback,
        balance: newBalance,
        description: `Uphaar cashback (${best.scheme.name}) on order ${order.orderNumber}`,
        reference: order._id,
        referenceType: 'cashback',
      });
      Scheme.updateOne({ _id: best.scheme._id }, { $inc: { usageCount: 1 } }).catch(() => {});
    }

    // 2) Uphaar box progress — persist a snapshot on the retailer so the
    //    tier badge is available without re-aggregating everywhere.
    const summary = await getRetailerRewardSummary(retailer._id);
    retailer.uphaarPoints = summary.totalBoxes;               // points == qualifying boxes
    retailer.uphaarTier   = tierForBoxes(summary.totalBoxes); // enum-safe (Silver/Gold/Platinum)
    await retailer.save({ validateBeforeSave: false });
  } catch (err) {
    // Never let a rewards problem break the order flow.
    console.error('[rewards:creditOrderRewards]', err && err.message);
  }
}

/**
 * Map cumulative boxes to the Retailer.uphaarTier enum (Silver|Gold|Platinum).
 * NOTE: the storefront slab art also shows a "bronze" band for the lowest
 * boxes, but the persisted enum only has three values, so bronze folds into
 * the Silver floor here. The detailed slab placement is done in the UI from
 * the real RETAILER_SCHEMES array.
 */
function tierForBoxes(boxes) {
  if (boxes >= 250) return 'Platinum';
  if (boxes >= 100) return 'Gold';
  return 'Silver';
}

function toObjectId(id) {
  const mongoose = require('mongoose');
  return (id instanceof mongoose.Types.ObjectId) ? id : new mongoose.Types.ObjectId(String(id));
}

module.exports = { getRetailerRewardSummary, creditOrderRewards, tierForBoxes, QUALIFYING_STATUSES };
