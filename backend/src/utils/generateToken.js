const jwt = require('jsonwebtoken');
const authCfg = require('../config/auth');

/**
 * Signs a short-lived ACCESS token. `tokenVersion` (tv) lets the server invalidate every
 * outstanding access token of a user at once (logout-everywhere) by bumping User.tokenVersion.
 */
const generateToken = (userId, role, tokenVersion = 0) =>
  jwt.sign({ id: String(userId), role, tv: tokenVersion }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: authCfg.ACCESS_TTL,
    issuer: authCfg.JWT_ISSUER,
    audience: authCfg.JWT_AUDIENCE
  });

/** Verifies signature, algorithm, issuer, audience and expiry. Throws on any problem. */
const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: authCfg.JWT_ISSUER,
    audience: authCfg.JWT_AUDIENCE
  });

module.exports = generateToken;
module.exports.verifyAccessToken = verifyAccessToken;
