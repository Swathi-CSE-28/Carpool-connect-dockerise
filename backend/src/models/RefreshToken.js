const mongoose = require('mongoose');

/**
 * One row per issued refresh token. Only a SHA-256 hash is stored, so a database leak does not
 * hand out usable sessions. Tokens that belong to the same login share a `family`; presenting an
 * already-rotated token means it was stolen/replayed, so the whole family is revoked.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    userAgent: { type: String, maxlength: 200 },
    ip: { type: String, maxlength: 64 }
  },
  { timestamps: true }
);

// Expired rows are removed automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
