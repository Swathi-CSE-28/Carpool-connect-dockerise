const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const Waitlist = require('../models/Waitlist');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { revokePassengerAccess } = require('../services/trackingService');

// POST /api/bookings (passenger)
const createBooking = asyncHandler(async (req, res) => {
  const { rideId, pickupPointId, seatsRequested, acceptDistanceBilling } = req.body;
  if (!rideId) throw new ApiError(400, 'rideId is required');

  const ride = await Ride.findById(rideId);
  if (!ride || ride.status === 'cancelled') throw new ApiError(404, 'Ride not found or cancelled');
  if (ride.status !== 'scheduled') throw new ApiError(409, 'This ride has already started or finished and can no longer be booked');

  // Distance-based billing needs the passenger's explicit agreement up front.
  if (ride.fareBasis === 'actual' && acceptDistanceBilling !== true) {
    throw new ApiError(
      400,
      'This driver bills by the distance actually travelled. Please agree to distance-based billing to book, or choose another ride.'
    );
  }

  if (ride.womenOnly && req.user.gender !== 'female') {
    throw new ApiError(403, 'This ride is reserved for female passengers');
  }

  const existing = await Booking.findOne({ ride: rideId, passenger: req.user._id, status: { $in: ['pending', 'accepted'] } });
  if (existing) throw new ApiError(400, 'You already have an active booking for this ride');

  const seats = seatsRequested || 1;

  if (ride.seatsAvailable < seats) {
    throw new ApiError(409, 'Not enough seats available. Consider joining the waiting list or searching alternatives.');
  }

  // Price quoted for THIS passenger's pickup point (shorter remaining road distance = lower fare).
  const chosenPickup = pickupPointId ? ride.pickupPoints.id(pickupPointId) : null;
  if (pickupPointId && !chosenPickup) throw new ApiError(400, 'That pickup point is not part of this ride');
  const quotedPerSeat = ride.fareMode === 'auto' && Number.isFinite(chosenPickup?.fare) ? chosenPickup.fare : ride.pricePerSeat;

  const booking = await Booking.create({
    ride: rideId,
    passenger: req.user._id,
    pickupPointId,
    quotedPerSeat,
    seatsRequested: seats,
    acceptedDistanceBilling: ride.fareBasis === 'actual' && acceptDistanceBilling === true,
    status: 'pending'
  });

  await Notification.create({
    user: ride.driver,
    type: 'booking_requested',
    title: 'New booking request',
    message: `${req.user.name} requested ${seats} seat(s) on your ride to ${ride.destination.label}.`,
    relatedRide: ride._id,
    relatedBooking: booking._id
  });

  res.status(201).json({ success: true, booking });
});

// GET /api/bookings/my (passenger's own bookings)
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ passenger: req.user._id })
    .populate({
      path: 'ride',
      populate: { path: 'driver', select: 'name ratingAverage avatarColor' }
    })
    .sort({ createdAt: -1 });
  res.json({ success: true, count: bookings.length, bookings });
});

// GET /api/bookings/ride/:rideId (driver: manage requests for their own ride)
const getBookingsForRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.rideId);
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (String(ride.driver) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view these bookings');
  }

  const bookings = await Booking.find({ ride: ride._id }).populate('passenger', 'name ratingAverage avatarColor phone');
  res.json({ success: true, count: bookings.length, bookings });
});

// PATCH /api/bookings/:id/status (driver accepts/rejects; passenger cancels)
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'accepted' | 'rejected' | 'cancelled' | 'completed'
  const booking = await Booking.findById(req.params.id).populate('ride');
  if (!booking) throw new ApiError(404, 'Booking not found');

  const ride = booking.ride;
  const isDriver = String(ride.driver) === String(req.user._id);
  const isPassenger = String(booking.passenger) === String(req.user._id);

  if (!isDriver && !isPassenger && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to update this booking');
  }

  if (status === 'completed' && ['active', 'paused'].includes(ride.tracking?.state)) {
    throw new ApiError(409, 'Use "End Ride" on the live tracking page to complete this trip and finalize the fare');
  }

  if (['accepted', 'rejected'].includes(status) && !isDriver && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the ride driver can accept or reject bookings');
  }

  if (status === 'accepted') {
    if (ride.seatsAvailable < booking.seatsRequested) {
      throw new ApiError(409, 'Not enough seats remaining to accept this booking');
    }
    ride.seatsAvailable -= booking.seatsRequested;
    await ride.save();

    await Notification.create({
      user: booking.passenger,
      type: 'booking_accepted',
      title: 'Booking accepted',
      message: `Your booking for the ride to ${ride.destination.label} was accepted.`,
      relatedRide: ride._id,
      relatedBooking: booking._id
    });
  }

  if (status === 'rejected') {
    await Notification.create({
      user: booking.passenger,
      type: 'booking_rejected',
      title: 'Booking rejected',
      message: `Your booking for the ride to ${ride.destination.label} was rejected.`,
      relatedRide: ride._id,
      relatedBooking: booking._id
    });
  }

  if (status === 'cancelled' && booking.status === 'accepted') {
    // release the seat back
    ride.seatsAvailable += booking.seatsRequested;
    await ride.save();
    await promoteFromWaitlist(ride._id);
  }

  if (status === 'completed') {
    await User.findByIdAndUpdate(booking.passenger, { $inc: { completedRides: 1 } });
  }

  booking.status = status;
  booking.respondedAt = new Date();
  await booking.save();

  // Anyone whose booking is no longer confirmed loses live-location access immediately.
  if (['cancelled', 'rejected'].includes(status)) {
    revokePassengerAccess(req.app.get('io'), ride._id, booking.passenger, `booking_${status}`);
  }

  res.json({ success: true, booking });
});

// DELETE /api/bookings/:id (passenger cancels their own booking)
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('ride');
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (String(booking.passenger) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only cancel your own bookings');
  }

  if (booking.status === 'accepted') {
    booking.ride.seatsAvailable += booking.seatsRequested;
    await booking.ride.save();
    await promoteFromWaitlist(booking.ride._id);
  }

  booking.status = 'cancelled';
  await booking.save();

  revokePassengerAccess(req.app.get('io'), booking.ride._id, booking.passenger, 'booking_cancelled');

  res.json({ success: true, message: 'Booking cancelled', booking });
});

// shared helper: promote the next waiting-list passenger when a seat frees up
async function promoteFromWaitlist(rideId) {
  const next = await Waitlist.findOne({ ride: rideId, status: 'waiting' }).sort({ position: 1 });
  if (!next) return;

  next.status = 'promoted';
  await next.save();

  await Notification.create({
    user: next.passenger,
    type: 'waitlist_seat_available',
    title: 'A seat opened up!',
    message: 'A seat is now available on a ride you were waitlisted for. Book quickly before it fills up.',
    relatedRide: rideId
  });
}

module.exports = { createBooking, getMyBookings, getBookingsForRide, updateBookingStatus, cancelBooking, promoteFromWaitlist };
