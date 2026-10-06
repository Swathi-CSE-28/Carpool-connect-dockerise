const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { quote } = require('../controllers/fareController');

const router = express.Router();

router.use(protect, authorize('driver', 'admin'));
router.post(
  '/quote',
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?._id || 'anonymous'),
    message: { success: false, message: 'Too many fare quotes, slow down.' }
  }),
  quote
);

module.exports = router;
