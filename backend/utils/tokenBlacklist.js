/**
 * Token Blacklist - Simple in-memory implementation
 * For production with multiple servers, use Redis instead
 *
 * This prevents JWT tokens from being reused after logout
 * Tokens automatically expire based on JWT expiry time
 */

// In-memory store of blacklisted tokens
// Format: { token: expiryTime }
const blacklist = new Map();

/**
 * Add a token to the blacklist
 * @param {string} token - JWT token to blacklist
 * @param {Date} expiresAt - Token expiration time (from JWT decoded data)
 */
const addToBlacklist = (token, expiresAt) => {
  if (!token || !expiresAt) return;

  // Add token with its expiration time
  blacklist.set(token, expiresAt);

  // Optional: Log for debugging
  console.log('[TokenBlacklist] Token added to blacklist, expires at:', expiresAt);
};

/**
 * Check if a token is blacklisted
 * @param {string} token - JWT token to check
 * @returns {boolean} true if token is blacklisted, false otherwise
 */
const isBlacklisted = (token) => {
  if (!token) return false;

  const expiryTime = blacklist.get(token);
  if (!expiryTime) return false;

  // Check if token is still in blacklist and hasn't expired
  const now = new Date();
  if (expiryTime > now) {
    return true; // Token is blacklisted
  }

  // Token has expired naturally, remove from blacklist
  blacklist.delete(token);
  return false;
};

/**
 * Cleanup: Periodically remove expired tokens from blacklist
 * Run this every 10 minutes to free up memory
 */
const cleanupExpiredTokens = () => {
  const now = new Date();
  let removed = 0;

  for (const [token, expiryTime] of blacklist.entries()) {
    if (expiryTime <= now) {
      blacklist.delete(token);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[TokenBlacklist] Cleaned up ${removed} expired tokens`);
  }
};

// Schedule cleanup every 10 minutes
setInterval(cleanupExpiredTokens, 10 * 60 * 1000);

/**
 * Get blacklist size (for monitoring)
 */
const getBlacklistSize = () => blacklist.size;

/**
 * Clear entire blacklist (for testing/debugging only)
 */
const clearBlacklist = () => {
  blacklist.clear();
  console.log('[TokenBlacklist] Blacklist cleared');
};

module.exports = {
  addToBlacklist,
  isBlacklisted,
  cleanupExpiredTokens,
  getBlacklistSize,
  clearBlacklist
};
