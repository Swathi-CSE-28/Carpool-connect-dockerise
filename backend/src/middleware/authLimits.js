const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/apiError');

// Brute-force protection for credential endpoints (per client IP). Relaxed under test so suites can log in repeatedly.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.' }
});

// Cookie-authenticated endpoints must come from our own frontend (defence in depth next to SameSite).
const allowedOrigins = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim().replace(/\/$/, ''));

const requireTrustedOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins().includes(origin.replace(/\/$/, ''))) {
    throw new ApiError(403, 'Request origin is not allowed');
  }
  next();
};

module.exports = { authLimiter, requireTrustedOrigin };
