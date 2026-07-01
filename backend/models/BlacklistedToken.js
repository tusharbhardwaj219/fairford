/* =====================================================================
   models/BlacklistedToken.js — revoked JWTs (persisted logout blacklist)
   Stores a SHA-256 hash of the token (never the raw JWT). A TTL index on
   expiresAt lets MongoDB auto-purge entries once the token would have
   expired anyway, so the collection stays small.
   ===================================================================== */
const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — document is removed once `expiresAt` is in the past.
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
