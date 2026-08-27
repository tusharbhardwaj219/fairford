const router = require('express').Router();
const { getProfile, updateProfile, getProducts } = require('../controllers/retailerController');
const { getWallet, getRewards, getInvoices, getInvoice } = require('../controllers/retailerRewardsController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Profile + product browsing are allowed before KYC activation so a retailer can
// complete their shop address while pending. Ordering itself is gated by
// requireActive on POST /api/orders.
const retAuth = [verifyToken, authorizeRoles('ret')];

router.get('/profile',  ...retAuth, getProfile);
router.put('/profile',  ...retAuth, updateProfile);
router.get('/products', ...retAuth, getProducts);

// Phase 3 — Uphaar rewards, wallet (cashback) ledger, and GST invoices.
// All read-only and scoped to the authenticated retailer.
router.get('/wallet',              ...retAuth, getWallet);
router.get('/rewards',             ...retAuth, getRewards);
router.get('/invoices',            ...retAuth, getInvoices);
router.get('/invoices/:orderId',   ...retAuth, getInvoice);

module.exports = router;
