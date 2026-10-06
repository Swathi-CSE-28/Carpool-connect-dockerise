const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  getRides, getAlternativeRides, getWomenOnlyRides, getRideById, getRecentlyViewed,
  createRide, updateRide, deleteRide, getMyRides
} = require('../controllers/rideController');

const router = express.Router();

// specific routes before /:id
router.get('/alternatives', protect, getAlternativeRides);
router.get('/women-only', protect, getWomenOnlyRides);
router.get('/recent', protect, getRecentlyViewed);
router.get('/driver/mine', protect, authorize('driver'), getMyRides);

router.get('/', protect, getRides);
router.post('/', protect, authorize('driver'), createRide);
router.get('/:id', protect, getRideById);
router.patch('/:id', protect, authorize('driver'), updateRide);
router.delete('/:id', protect, authorize('driver', 'admin'), deleteRide);

module.exports = router;
