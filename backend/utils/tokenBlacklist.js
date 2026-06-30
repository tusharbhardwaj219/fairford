/**
 * Token Blacklist — MongoDB-backed so logouts survive a server restart
 * (the previous in-memory Map was lost on restart, re-validating "logged out"
 * tokens). A small in-memory cache fronts the DB for fast repeat hits.
 *
 * Stores a SHA-256 hash of the token, never the raw JWT.
 */
const crypto = require('crypto');
const BlacklistedToken = require('../models/BlacklistedToken');

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// tokenHash -> expiry epoch ms (process-local cache)
const cache = new Map();

/**
 * Add a token to the blacklist (persisted + cached).
 * @param {string} token
 * @param {Date}   expiresAt
 */
const addToBlacklist = async (token, expiresAt) => {
  if (!token || !expiresAt) return;
  const tokenHash = hashToken(token);
  const exp = new Date(expiresAt);
  cache.set(tokenHash, exp.getTime());
  try {
    await BlacklistedToken.updateOne(
      { tokenHash },
      { $set: { tokenHash, expiresAt: exp } },
      { upsert: true }
    );
  } catch (err) {
    // Persistence is best-effort; the cache still covers this process.
    console.warn('[TokenBlacklist] persist failed:', err.message);
  }
};

/**
 * Check if a token is blacklisted. Async (cache first, then DB).
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const isBlacklisted = async (token) => {
  if (!token) return false;
  const tokenHash = hashToken(token);

  const cached = cache.get(tokenHash);
  if (cached) {
    if (cached > Date.now()) return true;
    cache.delete(tokenHash); // expired
  }

  try {
    const doc = await BlacklistedToken.findOne({ tokenHash }).lean();
    if (doc && new Date(doc.expiresAt).getTime() > Date.now()) {
      cache.set(tokenHash, new Date(doc.expiresAt).getTime());
      return true;
    }
  } catch (err) {
    console.warn('[TokenBlacklist] lookup failed:', err.message);
  }
  return false;
};

/** Drop expired entries from the in-memory cache (DB is handled by the TTL index). */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [tokenHash, exp] of cache.entries()) {
    if (exp <= now) cache.delete(tokenHash);
  }
};
setInterval(cleanupExpiredTokens, 10 * 60 * 1000);

const getBlacklistSize = () => cache.size;
const clearBlacklist = () => cache.clear();

module.exports = {
  addToBlacklist,
  isBlacklisted,
  cleanupExpiredTokens,
  getBlacklistSize,
  clearBlacklist,
};
