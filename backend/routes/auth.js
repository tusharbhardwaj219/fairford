const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const User    = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

// ─── Token helpers ────────────────────────────────────────────────────────────

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      confirmPassword,
      role,
      businessName,
      drugLicenseNumber,
      gstNumber,
      panNumber,
      state,
      city,
      address,
      pincode,
      alternateMobile
    } = req.body;

    // Required field check
    const required = { name, email, mobile, password, role, businessName, drugLicenseNumber, panNumber, state, city, address, pincode };
    const missing  = Object.entries(required).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    // Role validation
    if (!['distributor', 'retailer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be distributor or retailer' });
    }

    // Password checks
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase letter' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one lowercase letter' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one number' });
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one special character' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // Duplicate checks — run all in parallel for speed
    const [emailExists, mobileExists, dlExists, panExists, gstExists] = await Promise.all([
      User.findOne({ email: email.toLowerCase().trim() }),
      User.findOne({ mobile: mobile.trim() }),
      User.findOne({ drugLicenseNumber: drugLicenseNumber.trim().toUpperCase() }),
      User.findOne({ panNumber: panNumber.trim().toUpperCase() }),
      gstNumber ? User.findOne({ gstNumber: gstNumber.trim().toUpperCase() }) : Promise.resolve(null)
    ]);

    if (emailExists)  return res.status(409).json({ success: false, message: 'Email is already registered. Please sign in or use a different email.' });
    if (mobileExists) return res.status(409).json({ success: false, message: 'Mobile number is already registered. Please use a different mobile number.' });
    if (dlExists)     return res.status(409).json({ success: false, message: 'Drug license number is already registered.' });
    if (panExists)    return res.status(409).json({ success: false, message: 'PAN number is already registered.' });
    if (gstExists)    return res.status(409).json({ success: false, message: 'GST number is already registered.' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name:              name.trim(),
      email:             email.toLowerCase().trim(),
      mobile:            mobile.trim(),
      password:          hashedPassword,
      role,
      businessName:      businessName.trim(),
      drugLicenseNumber: drugLicenseNumber.trim().toUpperCase(),
      gstNumber:         gstNumber ? gstNumber.trim().toUpperCase() : undefined,
      panNumber:         panNumber.trim().toUpperCase(),
      state:             state.trim(),
      city:              city.trim(),
      address:           address.trim(),
      pincode:           pincode.trim(),
      alternateMobile:   alternateMobile || null
    });

    const { accessToken, refreshToken } = generateTokens(newUser._id);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId:       newUser._id,
        name:         newUser.name,
        email:        newUser.email,
        role:         newUser.role,
        businessName: newUser.businessName,
        accessToken
      }
    });

  } catch (err) {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    // MongoDB duplicate key error (unique index violation)
    if (err.code === 11000) {
      const keyObj  = err.keyValue || err.keyPattern || {};
      const field   = Object.keys(keyObj)[0] || '';
      const fieldMessages = {
        email:             'Email is already registered. Please sign in or use a different email.',
        mobile:            'Mobile number is already registered. Please use a different mobile number.',
        drugLicenseNumber: 'Drug license number is already registered.',
        panNumber:         'PAN number is already registered.',
        gstNumber:         'GST number is already registered.',
        businessName:      'A business with this name is already registered.'
      };
      const message = fieldMessages[field]
        || (field ? `${field} is already registered with another account.` : 'Some information you entered is already registered. Please check your email, mobile, drug license, or PAN.');
      return res.status(409).json({ success: false, message });
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is not active. Contact support.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId:       user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        businessName: user.businessName,
        accessToken
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ─── POST /api/auth/refresh-token ─────────────────────────────────────────────
router.post('/refresh-token', (req, res) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token not provided' });
    }

    const decoded     = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const newRefresh  = jwt.sign({ userId: decoded.userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

    setRefreshCookie(res, newRefresh);
    res.status(200).json({ success: true, accessToken });

  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', verifyToken, (req, res) => {
  res.status(200).json({ success: true, data: req.user.toSafe() });
});

module.exports = router;
