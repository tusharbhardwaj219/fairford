/* =====================================================================
   utils/generateToken.js — JWT Token Generation
   Creates and manages JWT tokens for authentication
   ===================================================================== */

const jwt = require('jsonwebtoken');

const generateToken = (id, role = 'admin') => {
  return jwt.sign(
    {
      id: id,
      role: role
    },
    process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production_12345',
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
};

module.exports = generateToken;