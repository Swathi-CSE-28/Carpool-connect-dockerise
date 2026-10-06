const asyncHandler = require('../utils/asyncHandler');
const Booking = require('../models/Booking');
const { estimateEcoImpact } = require('../services/ecoService');

// GET /api/eco/my — personal estimated eco-impact stats for the logged-in passenger
const getMyEcoImpact = asyncHandler(async (req, res) => {
  const completedBookings = await Booking.find({ passenger: req.user._id, status: 'completed' }).populate('ride', 'distanceKm');
  const impact = estimateEcoImpact({ completedBookings });
  res.json({ success: true, impact });
});

module.exports = { getMyEcoImpact };
