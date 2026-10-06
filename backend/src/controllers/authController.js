const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const sessions = require('../services/sessionService');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { getGoogleClient } = require('../config/googleClient');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, gender, phone } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(400, 'An account with this email already exists');

  const allowedRoles = ['passenger', 'driver'];
  const safeRole = allowedRoles.includes(role) ? role : 'passenger'; // admin cannot be self-assigned

  const user = await User.create({ name, email, password, role: safeRole, gender, phone });
  const token = await sessions.startSession(req, res, user);

  res.status(201).json({ success: true, token, user: user.toSafeObject() });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');

  const token = await sessions.startSession(req, res, user);
  res.json({ success: true, token, user: user.toSafeObject() });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

// POST /api/auth/google  { credential, role?, gender? }
// Verifies a Google Identity Services ID token (OpenID Connect) server-side - signature, audience,
// issuer and expiry are all checked by google-auth-library - then finds-or-creates the local user.
//
//  * `role` / `gender` only matter when the account is being CREATED (passenger or driver; admin can
//    never be self-assigned). An existing account's role is never changed through OAuth.
//  * Only Google accounts with a verified email are accepted.
//  * Linking Google to an existing password account is only done for a verified Google email. If that
//    password account's email was never verified, the password is removed on linking: otherwise whoever
//    pre-registered someone else's email address could still log in to the account afterwards.
const googleAuth = asyncHandler(async (req, res) => {
  const { credential, role, gender } = req.body;
  if (!credential) throw new ApiError(400, 'Missing Google credential token');

  const client = getGoogleClient();
  if (!client) {
    throw new ApiError(501, 'Google OAuth is not configured on this server (set GOOGLE_CLIENT_ID)');
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired Google token');
  }

  if (!payload?.email || payload.email_verified !== true) {
    throw new ApiError(401, 'Your Google account email is not verified');
  }
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId: payload.sub }).select('+password');
  let passwordRemoved = false;
  let created = false;

  if (!user) {
    user = await User.findOne({ email }).select('+password');
    if (user) {
      // Link Google to the existing account for this (Google-verified) email.
      user.googleId = payload.sub;
      if (!user.isVerified) {
        if (user.password) passwordRemoved = true;
        user.password = undefined;
        user.authProvider = 'google';
        user.isVerified = true;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // end any session the pre-registrant might hold
        await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
      }
      await user.save({ validateBeforeSave: false });
    } else {
      user = await User.create({
        name: payload.name || email.split('@')[0],
        email,
        googleId: payload.sub,
        authProvider: 'google',
        role: ['passenger', 'driver'].includes(role) ? role : 'passenger', // admin can never be self-assigned
        gender: ['female', 'male', 'other', 'prefer_not_to_say'].includes(gender) ? gender : 'prefer_not_to_say',
        isVerified: true
      });
      created = true;
    }
  }

  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');

  const token = await sessions.startSession(req, res, user);
  res.json({ success: true, token, user: user.toSafeObject(), created, passwordRemoved });
});

// POST /api/auth/refresh - trades the httpOnly refresh cookie for a new access token (and rotates the cookie)
const refresh = asyncHandler(async (req, res) => {
  const { token, user } = await sessions.refreshSession(req, res);
  res.json({ success: true, token, user: user.toSafeObject() });
});

// POST /api/auth/logout - ends this browser's session (always succeeds)
const logout = asyncHandler(async (req, res) => {
  await sessions.endSession(req, res);
  res.json({ success: true, message: 'Signed out' });
});

// POST /api/auth/logout-all (protected) - ends every session on every device
const logoutAll = asyncHandler(async (req, res) => {
  await sessions.endAllSessions(req.user);
  sessions.clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out of all devices' });
});

// POST /api/auth/api-key  (protected) - issues/rotates the caller's public-API key
const generateApiKey = asyncHandler(async (req, res) => {
  const apiKey = `cpc_${crypto.randomBytes(24).toString('hex')}`;
  req.user.apiKey = apiKey;
  await req.user.save({ validateBeforeSave: false });
  res.json({ success: true, apiKey });
});

module.exports = { register, login, getMe, googleAuth, refresh, logout, logoutAll, generateApiKey };
