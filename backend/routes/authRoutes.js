const router = require('express').Router();
const { signup, login, getProfile, logout, updateProfileImage } = require('../controllers/authController');
const { verifyToken: authenticate } = require('../middleware/authMiddleware');
const { validateSignup, validateLogin } = require('../middleware/validation');
const { uploadUserImage, handleUploadError } = require('../middleware/uploadMiddleware');

router.post('/signup',  validateSignup, signup);
router.post('/login',   validateLogin,  login);
router.get ('/profile', authenticate,   getProfile);
router.post('/logout',  authenticate,   logout);

// Upload / replace profile image
router.put(
  '/profile/image',
  authenticate,
  uploadUserImage,
  handleUploadError,
  updateProfileImage
);

module.exports = router;
