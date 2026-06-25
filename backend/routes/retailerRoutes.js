const router = require('express').Router();
const { getProfile, updateProfile, getProducts } = require('../controllers/retailerController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Profile + product browsing are allowed before KYC activation so a retailer can
// complete their shop address while pending. Ordering itself is gated by
// requireActive on POST /api/orders.
const retAuth = [verifyToken, authorizeRoles('ret')];

router.get('/profile',  ...retAuth, getProfile);
router.put('/profile',  ...retAuth, updateProfile);
router.get('/products', ...retAuth, getProducts);

module.exports = router;
