const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  createLostItem, getLostItemsForRide, getLostItemById, updateLostItemStatus, claimLostItem
} = require('../controllers/lostItemController');

const router = express.Router();

router.post('/', protect, authorize('driver'), createLostItem);
router.get('/ride/:rideId', protect, getLostItemsForRide);
router.get('/:id', protect, getLostItemById);
router.patch('/:id/status', protect, authorize('driver', 'admin'), updateLostItemStatus);
router.post('/:id/claim', protect, claimLostItem);

module.exports = router;
