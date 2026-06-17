const router = require('express').Router();
const { getDashboard, getProfile, updateProfile, getProducts } = require('../controllers/distributorController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const distOnly = [verifyToken, authorizeRoles('dist')];

router.get('/dashboard', ...distOnly, getDashboard);
router.get('/profile',   ...distOnly, getProfile);
router.put('/profile',   ...distOnly, updateProfile);
router.get('/products',  ...distOnly, getProducts);

module.exports = router;
