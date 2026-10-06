const { verifyAccessToken } = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

// Verifies the JWT and attaches the authenticated user to req.user.
// Never trusts a user id sent by the client body/query for identity purposes.
const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw new ApiError(401, 'Not authorized, invalid or expired token');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Not authorized, user no longer exists or is deactivated');
  }

  // Access tokens issued before a logout-everywhere are rejected immediately.
  if ((decoded.tv ?? 0) !== (user.tokenVersion || 0)) {
    throw new ApiError(401, 'Not authorized, session was ended. Please sign in again');
  }

  req.user = user;
  next();
});

module.exports = { protect };
