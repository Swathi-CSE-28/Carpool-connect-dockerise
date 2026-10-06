const express = require('express');
const { protect } = require('../middleware/auth');
const {
  createBooking, getMyBookings, getBookingsForRide, updateBookingStatus, cancelBooking
} = require('../controllers/bookingController');

const router = express.Router();

router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/ride/:rideId', protect, getBookingsForRide);
router.patch('/:id/status', protect, updateBookingStatus);
router.delete('/:id', protect, cancelBooking);

module.exports = router;
