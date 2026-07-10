const router = require('express').Router();
const { signup, login, getProfile, logout, updateProfileImage, forgotPassword, resetPassword } = require('../controllers/authController');
const { verifyToken }                = require('../middleware/authMiddleware');
const { validateSignup, validateLogin } = require('../middleware/validation');
const { uploadUserImage, uploadDealerDocs, handleUploadError } = require('../middleware/uploadMiddleware');

// uploadDealerDocs (multer) runs first so multipart text fields populate req.body
// before validateSignup reads them; it also uploads the 4 registration documents
// to Cloudinary. handleUploadError keeps signup working if Cloudinary is unset.
router.post('/signup',  uploadDealerDocs, handleUploadError, validateSignup, signup);
router.post('/login',   validateLogin,  login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.get ('/profile', verifyToken,    getProfile);
router.post('/logout',  verifyToken,    logout);
router.put ('/profile/image', verifyToken, uploadUserImage, handleUploadError, updateProfileImage);

module.exports = router;
