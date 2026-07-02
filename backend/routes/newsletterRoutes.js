const router = require('express').Router();
const newsletterController = require('../controllers/newsletterController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [verifyToken, authorizeRoles('admin', 'superadmin')];

// Public
router.post('/subscribe',    newsletterController.subscribe);
router.post('/unsubscribe',  newsletterController.unsubscribe);
router.get('/status/:email', newsletterController.getStatus);

// Admin-only (was unauthenticated — anyone could blast HTML email to every
// subscriber or read subscriber stats).
router.post('/send-campaign', ...adminOnly, newsletterController.sendCampaign);
router.get('/stats',          ...adminOnly, newsletterController.getStats);

module.exports = router;
