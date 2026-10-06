const crypto = require('crypto');
const authCfg = require('../config/auth');
const generateToken = require('../utils/generateToken');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const newOpaqueToken = () => crypto.randomBytes(48).toString('base64url');

function setRefreshCookie(res, token) {
  res.cookie(authCfg.REFRESH_COOKIE, token, {
    ...authCfg.cookieOptions(),
    maxAge: authCfg.REFRESH_TTL_DAYS * 24 * 3600 * 1000
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(authCfg.REFRESH_COOKIE, authCfg.cookieOptions());
}

async function storeRefreshToken(user, req, family) {
  const raw = newOpaqueToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(raw),
    family,
    expiresAt: new Date(Date.now() + authCfg.REFRESH_TTL_DAYS * 24 * 3600 * 1000),
    userAgent: (req.headers['user-agent'] || '').slice(0, 200),
    ip: req.ip
  });
  return raw;
}

/** Starts a login session: returns a fresh access token and sets the refresh cookie. */
async function startSession(req, res, user) {
  const refresh = await storeRefreshToken(user, req, crypto.randomUUID());
  setRefreshCookie(res, refresh);
  return generateToken(user._id, user.role, user.tokenVersion || 0);
}

/**
 * Exchanges the refresh cookie for a new access token and rotates the refresh token.
 * Throws ApiError(401) for anything unusable (the cookie is cleared so the client stops retrying).
 */
async function refreshSession(req, res) {
  const fail = (message) => {
    clearRefreshCookie(res);
    return new ApiError(401, message);
  };

  const raw = req.cookies?.[authCfg.REFRESH_COOKIE];
  if (!raw) throw fail('No active session');

  const record = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!record) throw fail('Session not recognised, please sign in again');

  if (record.revokedAt) {
    // A rotated/revoked token was presented again: assume theft and end the whole login session.
    await RefreshToken.updateMany({ family: record.family, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    throw fail('This session is no longer valid, please sign in again');
  }
  if (record.expiresAt < new Date()) throw fail('Session expired, please sign in again');

  const user = await User.findById(record.user);
  if (!user || !user.isActive) throw fail('Account not found or deactivated');

  // Atomic rotation: only one concurrent request can consume this token.
  const consumed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  if (!consumed) throw fail('This session is no longer valid, please sign in again');

  const next = await storeRefreshToken(user, req, record.family);
  setRefreshCookie(res, next);
  return { token: generateToken(user._id, user.role, user.tokenVersion || 0), user };
}

/** Ends the session that owns the presented refresh cookie (idempotent). */
async function endSession(req, res) {
  const raw = req.cookies?.[authCfg.REFRESH_COOKIE];
  if (raw) {
    const record = await RefreshToken.findOne({ tokenHash: sha256(raw) });
    if (record) {
      await RefreshToken.updateMany({ family: record.family, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    }
  }
  clearRefreshCookie(res);
}

/** Signs a user out everywhere: kills all refresh tokens and every outstanding access token. */
async function endAllSessions(user) {
  await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
}

module.exports = { startSession, refreshSession, endSession, endAllSessions, clearRefreshCookie };
