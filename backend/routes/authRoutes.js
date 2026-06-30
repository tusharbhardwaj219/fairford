const router = require('express').Router();
const { signup, login, getProfile, logout, updateProfileImage, forgotPassword, resetPassword } = require('../controllers/authController');
const { verifyToken }                = require('../middleware/authMiddleware');
const { validateSignup, validateLogin } = require('../middleware/validation');
const { uploadUserImage, handleUploadError } = require('../middleware/uploadMiddleware');

router.post('/signup',  validateSignup, signup);
router.post('/login',   validateLogin,  login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.get ('/profile', verifyToken,    getProfile);
router.post('/logout',  verifyToken,    logout);
router.put ('/profile/image', verifyToken, uploadUserImage, handleUploadError, updateProfileImage);

module.exports = router;
