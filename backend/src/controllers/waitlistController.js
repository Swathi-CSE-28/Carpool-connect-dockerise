const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Waitlist = require('../models/Waitlist');
const Ride = require('../models/Ride');

// POST /api/waitlist (passenger joins waiting list for a full ride)
const joinWaitlist = asyncHandler(async (req, res) => {
  const { rideId } = req.body;
  const ride = await Ride.findById(rideId);
  if (!ride) throw new ApiError(404, 'Ride not found');

  if (ride.womenOnly && req.user.gender !== 'female') {
    throw new ApiError(403, 'This ride is reserved for female passengers');
  }

  const existing = await Waitlist.findOne({ ride: rideId, passenger: req.user._id, status: 'waiting' });
  if (existing) throw new ApiError(400, 'You are already on the waiting list for this ride');

  const count = await Waitlist.countDocuments({ ride: rideId, status: 'waiting' });

  const entry = await Waitlist.create({
    ride: rideId,
    passenger: req.user._id,
    position: count + 1,
    status: 'waiting'
  });

  res.status(201).json({ success: true, entry });
});

// GET /api/waitlist/my
const getMyWaitlist = asyncHandler(async (req, res) => {
  const entries = await Waitlist.find({ passenger: req.user._id })
    .populate({ path: 'ride', populate: { path: 'driver', select: 'name avatarColor' } })
    .sort({ createdAt: -1 });
  res.json({ success: true, count: entries.length, entries });
});

// DELETE /api/waitlist/:id (leave the waiting list)
const leaveWaitlist = asyncHandler(async (req, res) => {
  const entry = await Waitlist.findById(req.params.id);
  if (!entry) throw new ApiError(404, 'Waitlist entry not found');
  if (String(entry.passenger) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only leave your own waiting list entry');
  }

  entry.status = 'removed';
  await entry.save();

  // re-sequence remaining positions for that ride
  const remaining = await Waitlist.find({ ride: entry.ride, status: 'waiting' }).sort({ position: 1 });
  await Promise.all(remaining.map((r, idx) => Waitlist.findByIdAndUpdate(r._id, { position: idx + 1 })));

  res.json({ success: true, message: 'Removed from waiting list' });
});

module.exports = { joinWaitlist, getMyWaitlist, leaveWaitlist };
