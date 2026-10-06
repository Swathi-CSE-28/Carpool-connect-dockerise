const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { geoSearch, geoRoute } = require('../controllers/trackingController');

const router = express.Router();

const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || 'anonymous'),
  message: { success: false, message: 'Too many map lookups, slow down.' }
});

router.use(protect, geoLimiter);
router.get('/search', geoSearch);
router.get('/route', geoRoute);

module.exports = router;
