const jwt = require('jsonwebtoken');
const Distributor = require('../models/Distributor');
const Retailer    = require('../models/Retailer');
const Admin       = require('../models/Admin');
const { isBlacklisted } = require('../utils/tokenBlacklist');

function modelForRole(role) {
  if (role === 'dist')  return Distributor;
  if (role === 'ret')   return Retailer;
  if (role === 'admin' || role === 'superadmin') return Admin;
  return null;
}

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied — no token provided' });
  }

  const token = header.split(' ')[1];

  try {
    // Check if token is blacklisted (user logged out)
    if (isBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const Model = modelForRole(decoded.role);

    if (!Model) {
      return res.status(401).json({ success: false, message: 'Invalid token role' });
    }

    const user = await Model.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    req.user = user;
    req.user.id = user._id.toString();
    req.token = token; // Store token for logout
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expired. Please login again.'
      : 'Invalid token';
    return res.status(401).json({ success: false, message: msg });
  }
};

const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const Model   = modelForRole(decoded.role);
      if (Model) {
        const user = await Model.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
          req.user.id = user._id.toString();
        }
      }
    } catch (_) {
      // expired / invalid — proceed as anonymous
    }
  }
  next();
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied — insufficient permissions' });
  }
  next();
};

const requireActive = (req, res, next) => {
  if (req.user && req.user.status && req.user.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: req.user.status === 'pending'
        ? 'Account pending KYC approval. Please wait for admin verification.'
        : 'Account suspended. Please contact support.',
    });
  }
  next();
};

module.exports = { verifyToken, optionalAuth, authorizeRoles, requireActive };
