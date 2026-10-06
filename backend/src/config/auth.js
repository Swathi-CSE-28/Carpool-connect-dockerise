/**
 * Central auth configuration + the startup check for the JWT secret.
 *
 * Tokens:
 *  - ACCESS token: a short-lived JWT (default 15 min) sent as `Authorization: Bearer ...`.
 *  - REFRESH token: a long random opaque string (default 30 days) kept in an httpOnly cookie that
 *    JavaScript can't read. It is stored server-side only as a SHA-256 hash, rotated on every use,
 *    and a replayed (already used) refresh token revokes the whole login session.
 */
const WEAK_SECRETS = ['replace_this_with_a_long_random_secret', 'secret', 'changeme', 'jwt_secret'];

const isProd = () => process.env.NODE_ENV === 'production';

module.exports = {
  ACCESS_TTL: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TTL_DAYS: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  REFRESH_COOKIE: 'cc_refresh',
  JWT_ISSUER: 'carpool-connect',
  JWT_AUDIENCE: 'carpool-connect-web',

  cookieOptions() {
    return {
      httpOnly: true, // not readable from JavaScript (XSS can't steal it)
      secure: isProd() || process.env.COOKIE_SECURE === 'true', // HTTPS only in production
      // 'lax' works when frontend + API share a site (e.g. localhost:5173 -> localhost:5000).
      // For a frontend on a different site use COOKIE_SAMESITE=none (requires HTTPS).
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      path: '/api/auth' // only ever sent to the auth endpoints
    };
  },

  /** Throws on a missing/weak secret in production, warns in development. */
  assertJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set. Add a long random value to backend/.env');
    const weak = WEAK_SECRETS.includes(secret) || secret.length < 32;
    if (weak && isProd()) {
      throw new Error('JWT_SECRET is too weak for production: use at least 32 random characters (e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`).');
    }
    if (weak) console.warn('[auth] WARNING: JWT_SECRET is weak (placeholder or < 32 chars). Fine for local development, never for production.');
  }
};
