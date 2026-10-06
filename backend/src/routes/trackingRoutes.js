const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const c = require('../controllers/trackingController');

const router = express.Router();

// Per-user limits (protect runs first, so req.user is always set here).
const perUser = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?._id || 'anonymous'),
    message: { success: false, message }
  });

const locationLimiter = perUser(60 * 1000, 60, 'Too many location updates, slow down.');
const readLimiter = perUser(60 * 1000, 120, 'Too many requests, slow down.');

router.use(protect);

router.get('/emergency-contacts', c.emergencyContacts);
router.get('/rides/:rideId', readLimiter, c.getSnapshot);
router.get('/rides/:rideId/eta', readLimiter, c.getEta);

router.post('/rides/:rideId/start', authorize('driver'), c.start);
router.post('/rides/:rideId/pause', authorize('driver'), c.pause);
router.post('/rides/:rideId/resume', authorize('driver'), c.resume);
router.post('/rides/:rideId/status', authorize('driver'), c.progress);
router.post('/rides/:rideId/end', authorize('driver'), c.end);
router.post('/rides/:rideId/location', authorize('driver'), locationLimiter, c.location);

module.exports = router;
