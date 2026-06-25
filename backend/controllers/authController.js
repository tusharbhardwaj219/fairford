const bcrypt           = require('bcryptjs');
const jwt              = require('jsonwebtoken');
const Distributor      = require('../models/Distributor');
const Retailer         = require('../models/Retailer');
const Admin            = require('../models/Admin');
const cloudinary       = require('../config/cloudinary');
const generateToken    = require('../utils/generateToken');
const { addToBlacklist } = require('../utils/tokenBlacklist');

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
    const { name, email, password, role, phone } = req.body;

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

    // Prepare user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role,
      phone
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

    // Determine redirect URL based on role. Distributors no longer have a dashboard.
    const redirectTo = user.role === 'ret' ? '/retailer.html'
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
const logout = (req, res, next) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // Decode token to get expiration time
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          // Add token to blacklist with its expiration time
          const expiresAt = new Date(decoded.exp * 1000);
          addToBlacklist(token, expiresAt);
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

module.exports = { signup, login, getProfile, logout, updateProfileImage };
