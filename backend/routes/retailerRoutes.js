const router = require('express').Router();
const { getDashboard, getProfile, updateProfile, getProducts } = require('../controllers/retailerController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const retOnly = [verifyToken, authorizeRoles('ret')];

router.get('/dashboard', ...retOnly, getDashboard);
router.get('/profile',   ...retOnly, getProfile);
router.put('/profile',   ...retOnly, updateProfile);
router.get('/products',  ...retOnly, getProducts);

module.exports = router;
