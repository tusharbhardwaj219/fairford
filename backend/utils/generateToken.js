const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for user authentication
 * @param {string} id - User ID
 * @param {string} role - User role (admin, dist, ret, etc)
 * @returns {string} JWT token
 * @throws {Error} If JWT_SECRET is not set in environment
 */
const generateToken = (id, role) => {
  // Security: Require JWT_SECRET to be explicitly set - no fallback to hardcoded value
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Please set it in your .env file. ' +
      'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;
