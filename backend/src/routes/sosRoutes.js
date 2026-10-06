const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  triggerSOS, getMyAlerts, getActiveAlerts, acknowledgeAlert, resolveAlert
} = require('../controllers/sosController');

const router = express.Router();

router.post(
  '/',
  protect,
  [
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat(),
    body('rideId').optional().isMongoId()
  ],
  validate,
  triggerSOS
);

router.get('/mine', protect, getMyAlerts);

// Admin-only live safety queue
router.get('/', protect, authorize('admin'), getActiveAlerts);
router.patch('/:id/acknowledge', protect, authorize('admin'), acknowledgeAlert);
router.patch('/:id/resolve', protect, authorize('admin'), resolveAlert);

module.exports = router;
