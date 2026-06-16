const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Use the canonical User model; guard remaining schemas against double-registration
const User = require('../models/User');
const { orderSchema, cartSchema } = require('../src/model');
// Guard against double-registration (cart&order.js may load these first)
// Order and Cart are registered lazily inside /stats to avoid top-level conflicts

// ============ MIDDLEWARE ============

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ============ ROUTES ============

// @GET /api/users/profile
// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// @PUT /api/users/profile
// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, mobile, businessName, state, city, address: addr, pincode } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields (new schema uses name/mobile/businessName)
    if (name)         user.name         = name;
    if (mobile)       user.mobile       = mobile;
    if (businessName) user.businessName = businessName;
    if (state)        user.state        = state;
    if (city)         user.city         = city;
    if (addr)         user.address      = addr;
    if (pincode)      user.pincode      = pincode;

    user.updatedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// @PUT /api/users/password
// Change password
router.put('/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.updatedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

// @POST /api/users/avatar
// Upload avatar
router.post('/avatar', verifyToken, async (req, res) => {
  try {
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: 'Avatar URL is required'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: avatarUrl, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      data: user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating avatar'
    });
  }
});

// @GET /api/users/stats
// Get user statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
    const Cart  = mongoose.models.Cart  || mongoose.model('Cart',  cartSchema);

    const totalOrders = await Order.countDocuments({ userId: req.userId });
    const totalSpent = await Order.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(req.userId), paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const cart = await Cart.findOne({ userId: req.userId });
    const cartItems = cart ? cart.items.length : 0;

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        totalSpent: totalSpent[0]?.total || 0,
        cartItems,
        memberSince: await User.findById(req.userId).select('createdAt')
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

// @GET /api/users/addresses
// Get saved addresses
router.get('/addresses', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('address');

    res.status(200).json({
      success: true,
      data: user ? user.address : {}
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching addresses'
    });
  }
});

// @PUT /api/users/address
// Update address
router.put('/address', verifyToken, async (req, res) => {
  try {
    const { street, city, state, pincode, country } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        address: {
          street: street || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
          country: country || 'India'
        },
        updatedAt: new Date()
      },
      { new: true }
    ).select('address');

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: user.address
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating address'
    });
  }
});

// @DELETE /api/users/account
// Delete account (soft delete)
router.delete('/account', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Soft delete
    user.status = 'inactive';
    user.updatedAt = new Date();
    await user.save();

    // Clear auth token
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting account'
    });
  }
});

// @GET /api/users/verify-email/:token
// Verify email
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying email'
    });
  }
});

module.exports = router;