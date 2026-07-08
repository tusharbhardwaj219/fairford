const express = require('express');
const router  = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/distributorInventoryController');

router.use(verifyToken, authorizeRoles('admin', 'superadmin'));

router.get('/dashboard',      ctrl.getDashboard);
router.get('/inventory',      ctrl.getInventory);
router.get('/product-detail', ctrl.getProductDetail);
router.get('/dispatch',       ctrl.getDispatches);
router.post('/dispatch',      ctrl.createDispatch);
router.get('/returns',        ctrl.getReturns);
router.post('/returns',       ctrl.createReturn);
router.put('/returns/:id',    ctrl.updateReturnStatus);
router.get('/notifications',  ctrl.getNotifications);
router.get('/distributors',   ctrl.getDistributors);
router.get('/products',       ctrl.getProducts);

// Retailer orders (from checkout) — view details + distribute/manage
router.get('/orders',             ctrl.getOrders);
router.get('/orders/:id',         ctrl.getOrderDetail);
router.put('/orders/:id/status',  ctrl.updateOrderStatus);
router.put('/orders/:id/payment', ctrl.updateOrderPayment);

module.exports = router;
