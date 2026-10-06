const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

/**
 * Authenticates machine/integration clients hitting /api/public/* using a
 * long-lived per-user API key (header: x-api-key) instead of a short-lived
 * JWT. Keys are generated on demand via POST /api/auth/api-key.
 */
const apiKeyAuth = asyncHandler(async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key) throw new ApiError(401, 'Missing x-api-key header');

  const user = await User.findOne({ apiKey: key }).select('+apiKey');
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid or revoked API key');

  req.apiUser = user;
  next();
});

module.exports = { apiKeyAuth };
