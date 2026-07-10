const Payment          = require('../models/Payment');
const Order            = require('../models/Order');
const Retailer         = require('../models/Retailer');
const Distributor      = require('../models/Distributor');
const WalletTransaction = require('../models/WalletTransaction');

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

module.exports = { getPaymentHistory, getOutstanding, createPayment, rechargeWallet, getWalletTransactions };
