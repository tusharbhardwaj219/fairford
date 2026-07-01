const bcrypt           = require('bcryptjs');
const jwt              = require('jsonwebtoken');
const crypto           = require('crypto');
const Distributor      = require('../models/Distributor');
const Retailer         = require('../models/Retailer');
const Admin            = require('../models/Admin');
const cloudinary       = require('../config/cloudinary');
const generateToken    = require('../utils/generateToken');
const { addToBlacklist } = require('../utils/tokenBlacklist');
const { sendPasswordResetEmail } = require('../services/emailService');

// Same policy enforced at signup (validation.js)
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Get appropriate model based on user role
 */
function modelForRole(role) {
  if (role === 'dist')  return Distributor;
  if (role === 'ret')   return Retailer;
  if (role === 'admin') return Admin;
  return null;
}

/**
 * POST /api/auth/signup
 * Register a new user (distributor or retailer)
 * Validation is done in middleware (validateSignup)
 */
const signup = async (req, res, next) => {
  try {
    const {
      name, email, password, role,
      phone, mobile,
      businessName, drugLicenseNumber, gstNumber, panNumber,
      state, city, address, pincode
    } = req.body;

    // Only retailers self-register. Distributors/stockists are onboarded by an admin.
    if (role !== 'ret') {
      return res.status(400).json({
        success: false,
        message: 'Self sign-up is available for retailers only.'
      });
    }

    // Get appropriate model for role
    const Model = modelForRole(role);
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Check if email already registered
    const existingUser = await Model.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Prepare user data — map frontend field names to the Retailer schema
    const userData = {
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role,
      phone: mobile || phone,
      shopName: businessName,
      drugLicenseNumber,
      gstNumber,
      shopAddress: {
        street: address,
        city,
        state,
        pincode
      }
    };

    // Retailers are no longer tied to a single distributor — each order is routed
    // to the nearest serviceable distributor/stockist at checkout (routingService).

    // Create user
    const newUser = await Model.create(userData);

    // Generate token
    const token = generateToken(newUser._id, newUser.role);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Awaiting KYC approval.',
      token,
      user: newUser.toSafe ? newUser.toSafe() : { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (err) {
    console.error('[auth:signup]', err);
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 * Includes brute force protection with account lockout after failed attempts
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    // Role-agnostic lookup: find the account by email across all identity
    // collections so a single login form works for retailers and admins alike.
    // Any `role` sent by the client is only a hint and is not required.
    let user = null;
    for (const Model of [Retailer, Admin, Distributor]) {
      user = await Model.findOne({ email: normalizedEmail }).select('+password');
      if (user) break;
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked due to failed login attempts
    if (user.isLocked && user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - new Date()) / 60000); // minutes
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${lockTimeRemaining} minutes.`
      });
    }

    // Guard: an admin-onboarded record (e.g. a distributor) may have no password
    // hash. bcrypt.compare(pw, undefined) throws, so treat it as a bad login.
    if (!user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      // Record failed login attempt
      if (user.recordFailedLogin) {
        await user.recordFailedLogin();
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Password is correct - reset login attempts
    if (user.resetLoginAttempts) {
      await user.resetLoginAttempts();
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id, user.role);

    // Determine redirect URL based on role. Retailers/distributors land on
    // their own minimal dashboard; admins land on the Super Admin dashboard.
    const redirectTo = user.role === 'ret' ? '/retailer.html'
                     : user.role === 'dist' ? '/distributor.html'
                     : (user.role === 'admin' || user.role === 'superadmin') ? '/superadmin.html'
                     : '/index.html';

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toSafe ? user.toSafe() : { _id: user._id, name: user.name, email: user.email, role: user.role },
      redirectTo
    });
  } catch (err) {
    console.error('[auth:login]', err);
    next(err);
  }
};

/**
 * GET /api/auth/profile
 * Get current authenticated user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const Model = modelForRole(req.user.role);
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await Model.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user: user.toSafe ? user.toSafe() : user
    });
  } catch (err) {
    console.error('[auth:profile]', err);
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Logout user by invalidating their token
 * Token is added to blacklist so it cannot be reused
 */
const logout = async (req, res, next) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // Decode token to get expiration time
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          // Add token to the (persisted) blacklist with its expiration time
          const expiresAt = new Date(decoded.exp * 1000);
          await addToBlacklist(token, expiresAt);
        }
      } catch (decodeErr) {
        console.warn('[auth:logout] Could not decode token:', decodeErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('[auth:logout]', err);
    next(err);
  }
};

/**
 * PUT /api/auth/profile/image
 * Update user profile image
 */
const updateProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const Model = modelForRole(req.user.role);
    const user = await Model.findById(req.user.id);

    if (!user) {
      // Clean up uploaded file if user not found
      await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove old profile image from Cloudinary if exists
    if (user.profileImage && user.profileImage.public_id) {
      await cloudinary.uploader.destroy(user.profileImage.public_id).catch(() => {});
    }

    // Update profile image
    user.profileImage = {
      url: req.file.path,
      public_id: req.file.filename
    };
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      data: user.profileImage
    });
  } catch (err) {
    // Clean up uploaded file on error
    if (req.file) {
      await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    }
    console.error('[auth:updateProfileImage]', err);
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 * Issue a one-time password-reset link (emailed). Always responds the same way
 * so the endpoint can't be used to enumerate which emails are registered.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Only the login-capable identities (retailers self-serve; admins). Distributors
    // are admin-managed and don't self-reset.
    let user = null;
    for (const Model of [Retailer, Admin]) {
      user = await Model.findOne({ email });
      if (user) break;
    }

    const genericMsg = 'If an account exists for that email, a reset link has been sent.';
    if (!user) return res.status(200).json({ success: true, message: genericMsg });

    // Send the raw token in the link; persist only its hash.
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken  = tokenHash;
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${base}/reset-password.html?token=${rawToken}`;
    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (mailErr) {
      // Don't leave a dangling reset token if the mail couldn't be sent.
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save({ validateBeforeSave: false });
      console.error('[auth:forgotPassword] email failed:', mailErr.message);
      return res.status(500).json({ success: false, message: 'Could not send reset email. Please try again later.' });
    }

    return res.status(200).json({ success: true, message: genericMsg });
  } catch (err) {
    console.error('[auth:forgotPassword]', err);
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Consume a reset token and set a new (policy-compliant) password.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }
    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a special character (@$!%*?&).',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    let user = null;
    for (const Model of [Retailer, Admin]) {
      user = await Model.findOne({
        resetPasswordToken:  tokenHash,
        resetPasswordExpire: { $gt: new Date() },
      }).select('+password +resetPasswordToken +resetPasswordExpire');
      if (user) break;
    }
    if (!user) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }

    user.password = password;          // hashed by the model's pre-save hook
    user.resetPasswordToken  = null;
    user.resetPasswordExpire = null;
    user.loginAttempts = 0;            // clear any brute-force lock too
    user.lockUntil = null;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('[auth:resetPassword]', err);
    next(err);
  }
};

module.exports = { signup, login, getProfile, logout, updateProfileImage, forgotPassword, resetPassword };
