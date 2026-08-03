const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const {
  getPaymentHistory, getOutstanding, createPayment,
  rechargeWallet, getWalletTransactions,
  // Razorpay
  getRazorpayConfig, createPaymentOrder, verifyPayment, paymentFailed, razorpayWebhook,
} = require('../controllers/paymentController');
const { verifyToken, authorizeRoles, requireActive } = require('../middleware/authMiddleware');

const auth    = [verifyToken, requireActive];
// Only an approved retailer can pay for a storefront order.
const retOnly = [verifyToken, authorizeRoles('ret'), requireActive];

// Payment endpoints are money-moving and brute-forceable (signature guessing),
// so they get a tighter budget than the global /api limiter.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many payment requests. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Razorpay (specific paths first) ──────────────────────────────────────────
// Webhook is server-to-server: no JWT, authenticated by its HMAC signature
// instead. Its raw body parser is mounted in server.js before express.json().
router.post('/webhook', razorpayWebhook);

router.get ('/config',  getRazorpayConfig);
router.post('/order',   paymentLimiter, ...retOnly, createPaymentOrder);
router.post('/verify',  paymentLimiter, ...retOnly, verifyPayment);
router.post('/failed',  paymentLimiter, ...retOnly, paymentFailed);

// ── Existing payment history / wallet ────────────────────────────────────────
router.get('/outstanding',         ...auth, getOutstanding);
router.get('/wallet/transactions', ...auth, getWalletTransactions);
router.post('/wallet/recharge',    ...auth, rechargeWallet);
router.get('/',                    ...auth, getPaymentHistory);
router.post('/',                   ...auth, createPayment);

module.exports = router;
