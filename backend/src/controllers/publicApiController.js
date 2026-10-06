const asyncHandler = require('../utils/asyncHandler');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Booking = require('../models/Booking');

/**
 * Read-only endpoints meant for third-party/integration use (e.g. a campus
 * portal widget), authenticated with a long-lived API key instead of a user
 * session. Kept deliberately narrow and non-sensitive.
 */

// GET /api/public/rides
const listPublicRides = asyncHandler(async (req, res) => {
  const rides = await Ride.find({ status: 'scheduled', seatsAvailable: { $gt: 0 } })
    .select('origin destination departureTime seatsAvailable pricePerSeat womenOnly')
    .sort({ departureTime: 1 })
    .limit(50);

  res.json({ success: true, apiUser: req.apiUser.name, count: rides.length, rides });
});

// GET /api/public/stats
const publicStats = asyncHandler(async (req, res) => {
  const [totalRides, totalUsers, completedBookings] = await Promise.all([
    Ride.countDocuments(),
    User.countDocuments({ isActive: true }),
    Booking.countDocuments({ status: 'accepted' })
  ]);

  res.json({
    success: true,
    apiUser: req.apiUser.name,
    stats: { totalRides, totalUsers, completedBookings }
  });
});

module.exports = { listPublicRides, publicStats };
