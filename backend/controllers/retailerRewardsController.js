/* =====================================================================
   retailerRewardsController.js — Fair Ford Pharmaceuticals
   Retailer-facing Phase 3 endpoints: Uphaar rewards summary, wallet
   (cashback) ledger, and GST invoices. All read REAL data — orders,
   wallet transactions, admin-created schemes — nothing is fabricated.
   Every handler is scoped to req.user._id so a retailer can only ever
   see their own wallet, rewards and invoices.
   ===================================================================== */
'use strict';

const Order             = require('../models/Order');
const Retailer          = require('../models/Retailer');
const Scheme            = require('../models/Scheme');
const WalletTransaction = require('../models/WalletTransaction');
const { getRetailerRewardSummary, tierForBoxes } = require('../services/rewardsService');

// Seller block for invoices — real company details (see T&C.html). No GSTIN is
// included because we don't have a verified one on file; better an honest gap
// than a fabricated tax number.
const SELLER = {
  name:    'Fair Ford Pharmaceuticals Pvt. Ltd.',
  address: 'Fair Ford Tower, Gali No-07, Main Road, Anangpur Village, Opposite Mount Kailash Factory, Faridabad - 121003 (Haryana)',
  email:   'info@fairfordpharma.com',
  phone:   '+91 9958584228',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ── GET /api/retailer/wallet ─────────────────────────────────────────────── */
// Current cashback balance + the ledger of credits/debits behind it.
const getWallet = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user._id).select('wallet');
    const txns = await WalletTransaction
      .find({ userId: req.user._id, userType: 'retailer' })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      balance: round2(retailer && retailer.wallet ? retailer.wallet.balance : 0),
      transactions: txns.map(t => ({
        id: String(t._id),
        type: t.type,
        amount: round2(t.amount),
        balance: round2(t.balance),
        description: t.description,
        referenceType: t.referenceType,
        date: t.createdAt,
      })),
    });
  } catch (err) {
    console.error('[retailer:getWallet]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ── GET /api/retailer/rewards ────────────────────────────────────────────── */
// Uphaar progress from real delivered orders + the active retailer schemes.
// The reward SLABS themselves (boxes → gift) live in the frontend
// (js/uphaar.js RETAILER_SCHEMES); here we return the retailer's real
// cumulative box count + spend so the UI can place them on those slabs.
const getRewards = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user._id).select('wallet uphaarPoints uphaarTier shopName');
    const summary  = await getRetailerRewardSummary(req.user._id);

    const now = new Date();
    const schemes = await Scheme.find({
      isActive: true,
      eligibleFor: { $in: ['retailer', 'both'] },
      validFrom: { $lte: now },
      validTo:   { $gte: now },
    }).select('name description schemeType cashbackPercentage discountPercentage flatOff minOrderValue maxCashback validTo terms eligibleTiers').lean();

    return res.status(200).json({
      success: true,
      rewards: {
        totalBoxes:  summary.totalBoxes,
        totalSpend:  round2(summary.totalSpend),
        orderCount:  summary.orderCount,
        firstOrderAt: summary.firstOrderAt,
        lastOrderAt:  summary.lastOrderAt,
        tier:         tierForBoxes(summary.totalBoxes),
        walletBalance: round2(retailer && retailer.wallet ? retailer.wallet.balance : 0),
      },
      schemes: schemes.map(s => ({
        name: s.name,
        description: s.description,
        type: s.schemeType,
        cashbackPercentage: s.cashbackPercentage,
        discountPercentage: s.discountPercentage,
        flatOff: s.flatOff,
        minOrderValue: s.minOrderValue,
        maxCashback: s.maxCashback,
        validTo: s.validTo,
        terms: s.terms || [],
        eligibleTiers: s.eligibleTiers || [],
      })),
    });
  } catch (err) {
    console.error('[retailer:getRewards]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ── GET /api/retailer/invoices ───────────────────────────────────────────── */
// Orders that have an invoice — invoicing starts at dispatch (see T&C:
// "Invoice on Dispatch"), so dispatched/delivered/returned orders qualify.
const getInvoices = async (req, res) => {
  try {
    const orders = await Order
      .find({ retailer: req.user._id, status: { $in: ['dispatched', 'delivered', 'returned'] } })
      .select('orderNumber createdAt actualDelivery totalAmount status items paymentMethod paymentStatus')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      invoices: orders.map(o => ({
        orderId: String(o._id),
        orderNumber: o.orderNumber,
        invoiceNumber: invoiceNumberFor(o.orderNumber),
        date: o.createdAt,
        deliveredAt: o.actualDelivery || null,
        itemCount: (o.items || []).length,
        totalAmount: round2(o.totalAmount),
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
      })),
    });
  } catch (err) {
    console.error('[retailer:getInvoices]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ── GET /api/retailer/invoices/:orderId ──────────────────────────────────── */
// Full invoice payload for one order, scoped to the requesting retailer.
const getInvoice = async (req, res) => {
  try {
    const order = await Order
      .findOne({ _id: req.params.orderId, retailer: req.user._id })
      .populate('retailer', 'name shopName phone gstNumber drugLicenseNumber shopAddress')
      .populate('distributor', 'businessName name phone email businessAddress')
      .lean();

    if (!order) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (!['dispatched', 'delivered', 'returned'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'An invoice is available once the order is dispatched.' });
    }

    const r = order.retailer || {};
    const addr = r.shopAddress || {};
    const items = (order.items || []).map(it => {
      const taxable = round2(it.totalPrice);
      const gst = round2((taxable * (it.gstRate || 0)) / 100);
      return {
        name: it.productName,
        brand: it.brand || '',
        quantity: it.quantity,
        unitPrice: round2(it.unitPrice),
        gstRate: it.gstRate || 0,
        taxableValue: taxable,
        gstAmount: gst,
        lineTotal: round2(taxable + gst),
      };
    });

    const dispatchedAt = (order.timeline || []).find(t => t.status === 'dispatched');

    return res.status(200).json({
      success: true,
      invoice: {
        invoiceNumber: invoiceNumberFor(order.orderNumber),
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        dispatchedAt: dispatchedAt ? dispatchedAt.timestamp : null,
        deliveredAt: order.actualDelivery || null,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        seller: SELLER,
        buyer: {
          name: r.shopName || r.name || 'Retailer',
          contactName: r.name || '',
          phone: r.phone || '',
          gstNumber: r.gstNumber || '',
          drugLicenseNumber: r.drugLicenseNumber || '',
          address: [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
        },
        deliveryAddress: order.deliveryAddress || {},
        items,
        totals: {
          subtotal: round2(order.subtotal),
          gstAmount: round2(order.gstAmount),
          discount: round2(order.discount),
          grandTotal: round2(order.totalAmount),
        },
      },
    });
  } catch (err) {
    console.error('[retailer:getInvoice]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ORD-YYYYMMDD-00001 → INV-YYYYMMDD-00001 (stable, derived from the order no.)
function invoiceNumberFor(orderNumber) {
  if (!orderNumber) return '';
  return String(orderNumber).replace(/^ORD-/, 'INV-');
}

module.exports = { getWallet, getRewards, getInvoices, getInvoice };
