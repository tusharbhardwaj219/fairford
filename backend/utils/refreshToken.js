/**
 * Refresh Token Utility
 * Generates and manages refresh tokens for long-lived sessions
 * Refresh tokens are longer-lived than access tokens
 */

const jwt = require('jsonwebtoken');

/**
 * Generate a refresh token
 * Refresh tokens last 30 days
 * @param {string} id - User ID
 * @param {string} role - User role
 * @returns {string} Refresh token
 */
const generateRefreshToken = (id, role) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  return jwt.sign(
    { id, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

/**
 * Verify a refresh token
 * @param {string} token - Refresh token to verify
 * @returns {object} Decoded token data
 * @throws {Error} If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // Verify it's actually a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (err) {
    throw new Error(`Invalid refresh token: ${err.message}`);
  }
};

module.exports = {
  generateRefreshToken,
  verifyRefreshToken
};
