const asyncHandler = require('../utils/asyncHandler');
const tracking = require('../services/trackingService');
const routing = require('../services/routingService');
const cfg = require('../config/tracking');
const ApiError = require('../utils/apiError');

const io = (req) => req.app.get('io');

// GET /api/tracking/rides/:rideId - snapshot for the driver or a confirmed passenger
const getSnapshot = asyncHandler(async (req, res) => {
  const snapshot = await tracking.getSnapshot(req.user._id, req.params.rideId);
  res.json({ success: true, ...snapshot });
});

// GET /api/tracking/rides/:rideId/eta
const getEta = asyncHandler(async (req, res) => {
  const eta = await tracking.getEta(req.user._id, req.params.rideId);
  res.json({ success: true, eta });
});

// POST /api/tracking/rides/:rideId/start (driver)
const start = asyncHandler(async (req, res) => {
  const ride = await tracking.startRide(req.user._id, req.params.rideId, io(req));
  res.json({ success: true, rideStatus: ride.status, trackingState: ride.tracking.state });
});

const pause = asyncHandler(async (req, res) => {
  const ride = await tracking.setPaused(req.user._id, req.params.rideId, io(req), true);
  res.json({ success: true, rideStatus: ride.status, trackingState: ride.tracking.state });
});

const resume = asyncHandler(async (req, res) => {
  const ride = await tracking.setPaused(req.user._id, req.params.rideId, io(req), false);
  res.json({ success: true, rideStatus: ride.status, trackingState: ride.tracking.state });
});

// POST /api/tracking/rides/:rideId/status  { step: 'arrived_pickup' | 'in_progress' | 'reached' }
const progress = asyncHandler(async (req, res) => {
  const ride = await tracking.updateProgress(req.user._id, req.params.rideId, req.body?.step, io(req));
  res.json({ success: true, rideStatus: ride.status, statusLabel: tracking.STATUS_LABELS[ride.status] });
});

// POST /api/tracking/rides/:rideId/end (driver) - finalizes distance + fares
const end = asyncHandler(async (req, res) => {
  const { actualMeters, fares } = await tracking.endRide(req.user._id, req.params.rideId, io(req));
  res.json({
    success: true,
    rideStatus: 'completed',
    actualDistanceKm: Math.round(actualMeters / 10) / 100,
    fares: fares.map((f) => ({ bookingId: f.bookingId, fare: f.fare }))
  });
});

// POST /api/tracking/rides/:rideId/location - HTTP fallback when the socket is down
const location = asyncHandler(async (req, res) => {
  const result = await tracking.ingestLocation(req.user._id, req.params.rideId, req.body, io(req));
  // Rejected readings are an expected outcome (200 with accepted:false), not a server error.
  res.status(result.accepted ? 200 : 202).json({ success: result.accepted, ...result });
});

const emergencyContacts = asyncHandler(async (req, res) => {
  res.json({ success: true, contacts: cfg.EMERGENCY_CONTACTS });
});

// GET /api/geo/search?q=
const geoSearch = asyncHandler(async (req, res) => {
  const result = await routing.searchPlaces(req.query.q);
  if (!result.ok) throw new ApiError(result.reason === 'rate_limited' ? 429 : 503, result.message);
  res.json({ success: true, results: result.results });
});

// GET /api/geo/route?points=lat,lng;lat,lng
const geoRoute = asyncHandler(async (req, res) => {
  const points = String(req.query.points || '')
    .split(';')
    .map((pair) => pair.split(',').map(Number))
    .map(([lat, lng]) => ({ lat, lng }));
  const result = await routing.getRoute(points);
  if (!result.ok) {
    const status = result.reason === 'invalid_input' ? 400 : result.reason === 'rate_limited' ? 429 : 503;
    throw new ApiError(status, result.message);
  }
  res.json({ success: true, ...result });
});

module.exports = { getSnapshot, getEta, start, pause, resume, progress, end, location, emergencyContacts, geoSearch, geoRoute };
