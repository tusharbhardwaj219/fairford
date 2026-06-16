const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Distributor = require('../models/Distributor');
const Retailer = require('../models/Retailer');

function modelForRole(role) {
  if (role === 'dist') return Distributor;
  if (role === 'ret') return Retailer;
  return User;
}

// Required auth — rejects if no valid token
const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied — no token provided' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const Model = modelForRole(decoded.role);
    const user = await Model.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Token valid but user no longer exists' });
    }

    req.user = user;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired. Please login again.'
        : 'Invalid token';
    return res.status(401).json({ success: false, message });
  }
};

// Optional auth — attaches req.user if token valid, never rejects
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const Model = modelForRole(decoded.role);
      const user = await Model.findById(decoded.id).select('-password');
      if (user) req.user = user;
    } catch (_) {
      // Invalid or expired — proceed anonymously
    }
  }
  next();
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this information.'
      });
    }
    next();
  };
};

module.exports = { verifyToken, optionalAuth, authorizeRoles };
