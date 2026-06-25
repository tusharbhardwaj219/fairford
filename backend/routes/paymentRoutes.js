const router = require('express').Router();
const {
  getPaymentHistory, getOutstanding, createPayment,
  rechargeWallet, getWalletTransactions,
} = require('../controllers/paymentController');
const { verifyToken, requireActive } = require('../middleware/authMiddleware');

const auth = [verifyToken, requireActive];

router.get('/outstanding',         ...auth, getOutstanding);
router.get('/wallet/transactions', ...auth, getWalletTransactions);
router.post('/wallet/recharge',    ...auth, rechargeWallet);
router.get('/',                    ...auth, getPaymentHistory);
router.post('/',                   ...auth, createPayment);

module.exports = router;
