const router = require('express').Router();
const {
  placeOrder, getOrders, getOrderById,
  approveOrder, dispatchOrder, deliverOrder,
  returnOrder, cancelOrder,
} = require('../controllers/orderController');
const { verifyToken, authorizeRoles, requireActive } = require('../middleware/authMiddleware');

const distOnly = [verifyToken, authorizeRoles('dist'), requireActive];
const retOnly  = [verifyToken, authorizeRoles('ret'),  requireActive];
const authAny  = [verifyToken, requireActive];

router.post('/',             ...retOnly,  placeOrder);
router.get('/',              ...authAny,  getOrders);
router.get('/:id',           ...authAny,  getOrderById);
router.put('/:id/approve',   ...distOnly, approveOrder);
router.put('/:id/dispatch',  ...distOnly, dispatchOrder);
router.put('/:id/deliver',   ...authAny,  deliverOrder);
router.put('/:id/return',    ...retOnly,  returnOrder);
router.put('/:id/cancel',    ...authAny,  cancelOrder);

module.exports = router;
