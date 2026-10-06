const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { findAlternativeRides } = require('../services/matchingService');
const { handleRideCancelled } = require('../services/trackingService');
const { quoteRoadFare, resolvePlaces } = require('../services/fareQuoteService');
const { isValidLatLng } = require('../utils/geo');

// Coordinates are optional (they're geocoded from the label when missing) but must be valid if sent.
function assertValidPlace(place, name) {
  if (place?.lat === undefined && place?.lng === undefined) return;
  if (!isValidLatLng(Number(place.lat), Number(place.lng))) {
    throw new ApiError(400, `${name} has invalid coordinates`);
  }
}

// GET /api/rides  (search + filter)
const getRides = asyncHandler(async (req, res) => {
  const { origin, destination, date, womenOnly, minSeats } = req.query;

  const query = { status: 'scheduled' };

  if (origin) query['origin.label'] = { $regex: origin, $options: 'i' };
  if (destination) query['destination.label'] = { $regex: destination, $options: 'i' };
  if (womenOnly === 'true') query.womenOnly = true;
  if (minSeats) query.seatsAvailable = { $gte: Number(minSeats) };

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.departureTime = { $gte: start, $lte: end };
  }

  const rides = await Ride.find(query)
    .populate('driver', 'name ratingAverage ratingCount completedRides cancelledRides isVerified avatarColor gender')
    .sort({ departureTime: 1 })
    .limit(100);

  // Women-only rides: don't leak driver gender info beyond what's needed to show the badge
  const sanitized = rides.map((r) => {
    const obj = r.toObject();
    if (obj.driver) delete obj.driver.gender;
    return obj;
  });

  res.json({ success: true, count: sanitized.length, rides: sanitized });
});

// GET /api/rides/alternatives?origin=&destination=&departureTime=&flexibleMinutes=
const getAlternativeRides = asyncHandler(async (req, res) => {
  const { origin, destination, departureTime, flexibleMinutes } = req.query;
  if (!origin || !destination) throw new ApiError(400, 'origin and destination are required');

  const windowStart = departureTime ? new Date(new Date(departureTime).getTime() - 24 * 60 * 60 * 1000) : null;
  const windowEnd = departureTime ? new Date(new Date(departureTime).getTime() + 24 * 60 * 60 * 1000) : null;

  const candidateQuery = { status: 'scheduled', seatsAvailable: { $gt: 0 } };
  if (windowStart && windowEnd) candidateQuery.departureTime = { $gte: windowStart, $lte: windowEnd };

  const candidates = await Ride.find(candidateQuery)
    .populate('driver', 'name ratingAverage ratingCount avatarColor');

  const alternatives = findAlternativeRides(
    { origin, destination, departureTime, flexibleMinutes: flexibleMinutes ? Number(flexibleMinutes) : 30 },
    candidates
  );

  res.json({ success: true, count: alternatives.length, alternatives });
});

// GET /api/rides/women-only
const getWomenOnlyRides = asyncHandler(async (req, res) => {
  const rides = await Ride.find({ womenOnly: true, status: 'scheduled' })
    .populate('driver', 'name ratingAverage ratingCount avatarColor isVerified')
    .sort({ departureTime: 1 });
  res.json({ success: true, count: rides.length, rides });
});

// GET /api/rides/:id
const getRideById = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.id).populate(
    'driver',
    'name ratingAverage ratingCount completedRides cancelledRides isVerified avatarColor'
  );
  if (!ride) throw new ApiError(404, 'Ride not found');

  // "Recently Accessed" tracking: fire-and-forget, never blocks the response
  req.user.recordRideView(ride._id).catch(() => {});

  res.json({ success: true, ride });
});

// GET /api/rides/recent - the current user's last-viewed rides, most recent first
const getRecentlyViewed = asyncHandler(async (req, res) => {
  const populated = await req.user.populate({
    path: 'recentlyViewedRides.ride',
    populate: { path: 'driver', select: 'name ratingAverage ratingCount avatarColor' }
  });

  const rides = (populated.recentlyViewedRides || [])
    .filter((entry) => entry.ride) // drop entries whose ride was since deleted
    .map((entry) => ({ ride: entry.ride, viewedAt: entry.viewedAt }));

  res.json({ success: true, count: rides.length, recent: rides });
});

/**
 * Calculates distance + fares from the OSRM road route (fareMode "auto").
 * Returns the fields to store on the ride; throws a clear ApiError instead of guessing when
 * a place can't be located or the router is down.
 */
async function buildAutoFare(origin, destination, pickupPoints) {
  const failed = await resolvePlaces([origin, destination, ...pickupPoints]);
  if (failed.length) {
    throw new ApiError(422, `Could not locate "${failed[0]}" on the map. Pick it from the search results, or switch to a manual fare.`);
  }
  const quote = await quoteRoadFare({ origin, destination, pickupPoints });
  if (!quote.ok) {
    const status = quote.reason === 'no_route' ? 422 : 503;
    throw new ApiError(status, `${quote.message || 'The road route could not be calculated.'} Try again in a moment, or switch to a manual fare.`);
  }
  return {
    distanceKm: quote.distanceKm,
    pricePerSeat: quote.pricePerSeat,
    pickupPoints: pickupPoints.map((p, i) => ({
      ...p,
      distanceToDestKm: quote.pickups[i]?.distanceToDestKm,
      fare: quote.pickups[i]?.fare
    })),
    route: {
      distanceMeters: quote.distanceMeters,
      durationSec: quote.durationSec,
      geometry: quote.geometry,
      source: quote.source,
      computedAt: new Date()
    }
  };
}

// POST /api/rides (driver only)
const createRide = asyncHandler(async (req, res) => {
  const {
    origin, destination, pickupPoints, departureTime, flexibleMinutes,
    totalSeats, pricePerSeat, womenOnly, preferences, distanceKm, notes, fareBasis, fareMode
  } = req.body;

  if (!origin?.label || !destination?.label || !departureTime || !totalSeats) {
    throw new ApiError(400, 'origin, destination, departureTime and totalSeats are required');
  }

  // Enforce Women-Only eligibility on the backend, not just the frontend
  if (womenOnly && req.user.gender !== 'female') {
    throw new ApiError(403, 'Only drivers who identify as female can create a Women-Only ride');
  }

  if (fareBasis !== undefined && !['estimated', 'actual'].includes(fareBasis)) {
    throw new ApiError(400, "fareBasis must be 'estimated' or 'actual'");
  }
  if (fareMode !== undefined && !['manual', 'auto'].includes(fareMode)) {
    throw new ApiError(400, "fareMode must be 'manual' or 'auto'");
  }
  assertValidPlace(origin, 'Origin');
  assertValidPlace(destination, 'Destination');
  (pickupPoints || []).forEach((p, i) => assertValidPlace(p, `Pickup point ${i + 1}`));

  let pickups = (pickupPoints || []).map((p, idx) => ({ ...p, order: p.order ?? idx }));
  let price = pricePerSeat || 0;
  let distance = distanceKm || 0;
  let routeToStore;

  if (fareMode === 'auto') {
    // Distance and price come from the road route, never from numbers sent by the client.
    const auto = await buildAutoFare(origin, destination, pickups);
    price = auto.pricePerSeat;
    distance = auto.distanceKm;
    pickups = auto.pickupPoints;
    routeToStore = auto.route;
  }

  const ride = await Ride.create({
    driver: req.user._id,
    origin,
    destination,
    pickupPoints: pickups,
    departureTime,
    flexibleMinutes: flexibleMinutes || 0,
    totalSeats,
    seatsAvailable: totalSeats,
    pricePerSeat: price,
    womenOnly: !!womenOnly,
    preferences: preferences || {},
    distanceKm: distance,
    fareBasis: fareBasis || 'estimated',
    fareMode: fareMode || 'manual',
    ...(routeToStore ? { tracking: { state: 'idle', route: routeToStore } } : {}),
    notes
  });

  res.status(201).json({ success: true, ride });
});

// PATCH /api/rides/:id (driver who owns the ride only)
const updateRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.id);
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (String(ride.driver) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only edit your own rides');
  }

  // Ride status is NOT editable here: it only moves through the tracking endpoints
  // (/api/tracking/rides/:id/start|status|end) so fares and location data stay consistent.
  if (req.body.status !== undefined) {
    throw new ApiError(400, 'Ride status is managed by the live tracking controls (start, arrive, end)');
  }
  if (['started', 'pickup_in_progress', 'on_the_way', 'reached', 'completed', 'cancelled'].includes(ride.status)) {
    throw new ApiError(409, 'A ride that has started or finished can no longer be edited');
  }

  if (req.body.fareBasis !== undefined) {
    if (!['estimated', 'actual'].includes(req.body.fareBasis)) {
      throw new ApiError(400, "fareBasis must be 'estimated' or 'actual'");
    }
    const activeBookings = await Booking.countDocuments({ ride: ride._id, status: { $in: ['pending', 'accepted'] } });
    if (activeBookings > 0 && req.body.fareBasis !== ride.fareBasis) {
      throw new ApiError(409, 'The billing policy cannot change once passengers have booked');
    }
    ride.fareBasis = req.body.fareBasis;
  }
  (req.body.pickupPoints || []).forEach((p, i) => assertValidPlace(p, `Pickup point ${i + 1}`));

  const isAuto = ride.fareMode === 'auto';
  if (isAuto && (req.body.pricePerSeat !== undefined || req.body.distanceKm !== undefined)) {
    throw new ApiError(400, 'This ride’s fare is calculated from the road route and can’t be edited by hand');
  }

  // Seat bookkeeping must use the totals as they were BEFORE this edit is applied.
  const previouslyBooked = ride.totalSeats - ride.seatsAvailable;

  const allowedFields = [
    'pickupPoints', 'departureTime', 'flexibleMinutes', 'totalSeats',
    'pricePerSeat', 'preferences', 'notes', 'distanceKm'
  ];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) ride[field] = req.body[field];
  }

  if (isAuto && req.body.pickupPoints !== undefined) {
    const pickups = req.body.pickupPoints.map((p, idx) => ({ ...p, order: p.order ?? idx }));
    const auto = await buildAutoFare(ride.origin.toObject(), ride.destination.toObject(), pickups);
    ride.pickupPoints = auto.pickupPoints;
    ride.pricePerSeat = auto.pricePerSeat;
    ride.distanceKm = auto.distanceKm;
    ride.tracking.route = auto.route;
  }

  // Women-only flag re-validated if being toggled
  if (req.body.womenOnly !== undefined) {
    if (req.body.womenOnly && req.user.gender !== 'female') {
      throw new ApiError(403, 'Only drivers who identify as female can set Women-Only');
    }
    ride.womenOnly = req.body.womenOnly;
  }

  if (req.body.totalSeats !== undefined) {
    ride.seatsAvailable = Math.max(req.body.totalSeats - previouslyBooked, 0);
  }

  await ride.save();
  res.json({ success: true, ride });
});

// DELETE /api/rides/:id (driver who owns the ride, or admin)
const deleteRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.id);
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (String(ride.driver) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only cancel your own rides');
  }

  if (ride.status === 'completed') throw new ApiError(409, 'A completed ride cannot be cancelled');

  ride.status = 'cancelled';
  await ride.save();

  // Auto-cancel pending/accepted bookings tied to this ride
  await Booking.updateMany(
    { ride: ride._id, status: { $in: ['pending', 'accepted'] } },
    { status: 'cancelled' }
  );

  // Stop broadcasting immediately and erase any live location data for this ride
  await handleRideCancelled(ride._id, req.app.get('io'));

  res.json({ success: true, message: 'Ride cancelled', ride });
});

// GET /api/rides/driver/mine (driver's own rides)
const getMyRides = asyncHandler(async (req, res) => {
  const rides = await Ride.find({ driver: req.user._id }).sort({ departureTime: -1 });
  res.json({ success: true, count: rides.length, rides });
});

module.exports = {
  getRides,
  getAlternativeRides,
  getWomenOnlyRides,
  getRideById,
  getRecentlyViewed,
  createRide,
  updateRide,
  deleteRide,
  getMyRides
};
