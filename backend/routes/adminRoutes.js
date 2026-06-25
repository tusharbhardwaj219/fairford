const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// All admin endpoints require an admin / superadmin token.
const adminOnly = [verifyToken, authorizeRoles('admin', 'superadmin')];

// Metrics
router.get('/metrics', ...adminOnly, ctrl.getMetrics);

// Orders — fulfilment lifecycle
router.get('/orders',            ...adminOnly, ctrl.listOrders);
router.put('/orders/:id/status', ...adminOnly, ctrl.updateOrderStatus);

// Retailers — KYC gate
router.get('/retailers',             ...adminOnly, ctrl.listRetailers);
router.put('/retailers/:id/approve', ...adminOnly, ctrl.approveRetailer);
router.put('/retailers/:id/suspend', ...adminOnly, ctrl.suspendRetailer);

// Distributors / stockists — routing coverage
router.get('/distributors',      ...adminOnly, ctrl.listDistributors);
router.post('/distributors',     ...adminOnly, ctrl.createDistributor);
router.put('/distributors/:id',  ...adminOnly, ctrl.updateDistributor);

module.exports = router;
