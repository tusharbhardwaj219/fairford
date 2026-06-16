const bcrypt     = require('bcryptjs');
const User        = require('../models/User');
const Distributor = require('../models/Distributor');
const Retailer    = require('../models/Retailer');
const cloudinary  = require('../config/cloudinary');
const { generateToken } = require('../config/jwt');

// Returns the right Mongoose model for the given role
function modelForRole(role) {
  if (role === 'dist') return Distributor;
  if (role === 'ret')  return Retailer;
  return User; // hosp, mfr, or unknown → general users collection
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const Model = modelForRole(role);

    if (await Model.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ success: false, message: 'Email is already registered' });

    const hashed  = await bcrypt.hash(password, 10);
    const newUser = await Model.create({ name, email, password: hashed, role });
    const token   = generateToken({ id: newUser._id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: newUser.toSafe()
    });
  } catch (err) {
    console.error('[signup]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const Model = modelForRole(role);

    const user = await Model.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken({ id: user._id, email: user.email, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toSafe()
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET /api/auth/profile (protected) ────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const Model = modelForRole(req.user.role);
    const user  = await Model.findById(req.user.id);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, user: user.toSafe() });
  } catch (err) {
    console.error('[profile]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
const logout = (_req, res) =>
  res.status(200).json({ success: true, message: 'Logged out successfully' });

// ── PUT /api/auth/profile/image (protected) ───────────────────────────────────
const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Only User model stores profileImage; Distributor/Retailer are plain schemas
    const Model = modelForRole(req.user.role);
    const user  = await Model.findById(req.user.id);
    if (!user) {
      await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete old profile image from Cloudinary if it exists
    if (user.profileImage && user.profileImage.public_id) {
      await cloudinary.uploader.destroy(user.profileImage.public_id).catch(() => {});
    }

    user.profileImage = {
      url:       req.file.path,
      public_id: req.file.filename
    };
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      data: {
        url:       user.profileImage.url,
        public_id: user.profileImage.public_id
      }
    });
  } catch (err) {
    if (req.file) {
      await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    }
    console.error('[updateProfileImage]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { signup, login, getProfile, logout, updateProfileImage };
