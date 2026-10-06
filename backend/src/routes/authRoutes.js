const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { register, login, getMe, googleAuth, refresh, logout, logoutAll, generateApiKey } = require('../controllers/authController');
const { authLimiter, requireTrustedOrigin } = require('../middleware/authLimits');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  login
);

router.get('/me', protect, getMe);

// Session lifecycle (JWT access token + rotating httpOnly refresh cookie)
router.post('/refresh', authLimiter, requireTrustedOrigin, refresh);
router.post('/logout', requireTrustedOrigin, logout);
router.post('/logout-all', protect, logoutAll);

// OAuth: Google Identity Services sends us a signed ID token to verify server-side
router.post('/google', authLimiter, [body('credential').notEmpty().withMessage('credential is required')], validate, googleAuth);

// Issues a personal API key for the /api/public/* integration endpoints
router.post('/api-key', protect, generateApiKey);

module.exports = router;
