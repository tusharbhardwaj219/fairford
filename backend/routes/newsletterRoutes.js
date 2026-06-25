const router = require('express').Router();
const newsletterController = require('../controllers/newsletterController');

router.post('/subscribe',    newsletterController.subscribe);
router.post('/unsubscribe',  newsletterController.unsubscribe);
router.get('/status/:email', newsletterController.getStatus);
router.post('/send-campaign', newsletterController.sendCampaign);
router.get('/stats',         newsletterController.getStats);

module.exports = router;
