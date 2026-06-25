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

// POST /api/payments — pay against an order
const createPayment = async (req, res) => {
  try {
    const { orderId, amount, method, notes } = req.body;

    if (!orderId || !amount || !method) {
      return res.status(400).json({ success: false, message: 'orderId, amount, and method are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.retailer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const retailer = await Retailer.findById(req.user._id);
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });

    const payAmount = Number(amount);

    if (method === 'wallet') {
      if (retailer.wallet.balance < payAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }
      retailer.wallet.balance -= payAmount;
    }

    retailer.creditUsed = Math.max(0, retailer.creditUsed - payAmount);
    await retailer.save();

    order.paymentStatus = retailer.creditUsed <= 0 ? 'paid' : 'partial';
    order.paymentMethod = method;
    await order.save();

    const payment = await Payment.create({
      retailer:    retailer._id,
      distributor: order.distributor,
      order:       order._id,
      amount:      payAmount,
      paymentType: 'order_payment',
      method,
      status:      'completed',
      paidAt:      new Date(),
      notes,
    });

    if (method === 'wallet') {
      await WalletTransaction.create({
        userId:        retailer._id,
        userType:      'retailer',
        type:          'debit',
        amount:        payAmount,
        balance:       retailer.wallet.balance,
        description:   `Payment for order ${order.orderNumber}`,
        reference:     payment._id,
        referenceType: 'payment',
      });
    }

    return res.status(201).json({ success: true, message: 'Payment processed', payment });
  } catch (err) {
    console.error('[payment:create]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/wallet/recharge — add funds to retailer wallet
const rechargeWallet = async (req, res) => {
  try {
    if (req.user.role !== 'ret') {
      return res.status(403).json({ success: false, message: 'Only retailers can recharge wallet' });
    }

    const { amount, reference } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const retailer = await Retailer.findById(req.user._id);
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });

    const rechargeAmount = Number(amount);
    retailer.wallet.balance += rechargeAmount;
    await retailer.save();

    const payment = await Payment.create({
      retailer:    retailer._id,
      distributor: retailer.distributor,
      amount:      rechargeAmount,
      paymentType: 'wallet_recharge',
      method:      'online',
      status:      'completed',
      reference:   reference || '',
      paidAt:      new Date(),
    });

    await WalletTransaction.create({
      userId:        retailer._id,
      userType:      'retailer',
      type:          'credit',
      amount:        rechargeAmount,
      balance:       retailer.wallet.balance,
      description:   'Wallet recharge',
      reference:     payment._id,
      referenceType: 'recharge',
    });

    return res.status(200).json({
      success: true,
      message: 'Wallet recharged successfully',
      walletBalance: retailer.wallet.balance,
    });
  } catch (err) {
    console.error('[payment:recharge]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
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
