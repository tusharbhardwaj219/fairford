const express = require('express');
const newsletterController = require('../controllers/newsletterController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/subscribe', newsletterController.subscribe);
router.post('/unsubscribe', newsletterController.unsubscribe);
router.get('/status/:email', newsletterController.getStatus);

// Admin-protected routes
router.post('/send-campaign', protect, newsletterController.sendCampaign);
router.get('/stats', protect, newsletterController.getStats);

module.exports = router;
