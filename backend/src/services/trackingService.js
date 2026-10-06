/**
 * Live GPS tracking - all business rules live here so the REST controller and
 * the Socket.IO handlers share exactly one implementation (and one set of
 * authorization checks).
 *
 * Ride tracking lifecycle (Ride.tracking.state):
 *   idle --start--> active <--pause/resume--> paused --end--> ended
 * and Ride.status moves: scheduled -> started (Driver En Route)
 *   -> pickup_in_progress (Arrived at Pickup) -> on_the_way (In Progress)
 *   -> reached -> completed        (or cancelled at any time before completion)
 */
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');
const cfg = require('../config/tracking');
const { haversineMeters, isValidLatLng, isNullIsland, isFiniteNumber } = require('../utils/geo');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const RideLocation = require('../models/RideLocation');
const RideLocationPoint = require('../models/RideLocationPoint');
const routing = require('./routingService');
const { finalizeFare, estimateFare, plannedDistanceKm } = require('./fareService');

class TrackingError extends ApiError {
  constructor(statusCode, code, message) {
    super(statusCode, message);
    this.code = code;
  }
}

const LIVE_STATES = ['active', 'paused'];
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  preparing: 'Scheduled',
  started: 'Driver En Route',
  pickup_in_progress: 'Arrived at Pickup',
  on_the_way: 'In Progress',
  reached: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};
// Driver-selectable progress steps, in the only order they may happen.
const PROGRESS = {
  arrived_pickup: 'pickup_in_progress',
  in_progress: 'on_the_way',
  reached: 'reached'
};
const PROGRESS_ORDER = ['started', 'pickup_in_progress', 'on_the_way', 'reached'];

const trackRoom = (rideId) => `track:${rideId}`;
const emitToRide = (io, rideId, event, payload) => io && io.to(trackRoom(rideId)).emit(event, payload);
const idOf = (v) => String(v && v._id ? v._id : v);

// ---------------------------------------------------------------------------
// Per-ride serialisation: GPS updates for one ride are processed one at a time
// so two quick updates can never both read the same "previous point" and
// double-count a segment. (Single Node process; see README for scaling notes.)
// ---------------------------------------------------------------------------
const rideQueues = new Map();
function withRideLock(rideId, task) {
  const key = String(rideId);
  const prev = rideQueues.get(key) || Promise.resolve();
  const next = prev.then(task, task);
  const tail = next.catch(() => {});
  rideQueues.set(key, tail);
  tail.then(() => {
    if (rideQueues.get(key) === tail) rideQueues.delete(key);
  });
  return next;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------
/**
 * Resolves the caller's relationship to a ride: 'driver' (owns it) or
 * 'passenger' (has a confirmed/completed booking on it). Anyone else - including
 * admins, for live location - is rejected.
 */
async function authorizeParticipant(userId, rideId) {
  if (!mongoose.isValidObjectId(rideId)) throw new TrackingError(400, 'INVALID_RIDE', 'Invalid ride id');

  const user = await User.findById(userId).select('isActive');
  if (!user || !user.isActive) throw new TrackingError(401, 'UNAUTHENTICATED', 'Account not found or deactivated');

  const ride = await Ride.findById(rideId).populate(
    'driver',
    'name phone ratingAverage ratingCount avatarColor isVerified vehicle'
  );
  if (!ride) throw new TrackingError(404, 'RIDE_NOT_FOUND', 'Ride not found');

  if (idOf(ride.driver) === String(userId)) return { role: 'driver', ride, booking: null };

  const booking = await Booking.findOne({
    ride: ride._id,
    passenger: userId,
    status: { $in: ['accepted', 'completed'] }
  });
  if (!booking) {
    throw new TrackingError(403, 'NOT_AUTHORIZED', 'You do not have a confirmed booking on this ride');
  }
  return { role: 'passenger', ride, booking };
}

/** Whether this participant may currently receive/see live location. */
function canSeeLive(ctx) {
  const { ride, role, booking } = ctx;
  if (ride.status === 'cancelled' || ride.status === 'completed') return false;
  if (role === 'passenger' && booking.status !== 'accepted') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Coordinates + planned route
// ---------------------------------------------------------------------------
/** Fills in missing coordinates from the place labels (geocoded server-side, never guessed). */
async function ensureCoordinates(ride) {
  const set = {};
  const targets = [
    { path: 'origin', obj: ride.origin },
    { path: 'destination', obj: ride.destination },
    ...(ride.pickupPoints || []).map((p, i) => ({ path: `pickupPoints.${i}`, obj: p }))
  ];
  for (const t of targets) {
    if (!t.obj || isValidLatLng(t.obj.lat, t.obj.lng)) continue;
    const hit = await routing.geocodeLabel(t.obj.label);
    if (hit) {
      set[`${t.path}.lat`] = hit.lat;
      set[`${t.path}.lng`] = hit.lng;
      t.obj.lat = hit.lat;
      t.obj.lng = hit.lng;
    }
  }
  if (Object.keys(set).length) await Ride.updateOne({ _id: ride._id }, { $set: set });
}

const coordsOf = (p) => (p && isValidLatLng(p.lat, p.lng) ? { lat: p.lat, lng: p.lng } : null);

/** Computes and stores the planned road route (origin -> pickups -> destination). Best effort. */
async function prepareRoute(rideId, io) {
  const ride = await Ride.findById(rideId);
  if (!ride) return null;
  await ensureCoordinates(ride);

  const origin = coordsOf(ride.origin);
  const destination = coordsOf(ride.destination);
  if (!origin || !destination) return null;

  const stops = [...(ride.pickupPoints || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(coordsOf)
    .filter(Boolean);
  const waypoints = [origin, ...stops, destination].slice(0, 25);

  const result = await routing.getRoute(waypoints);
  if (!result.ok) return null;

  const route = {
    distanceMeters: result.distanceMeters,
    durationSec: result.durationSec,
    geometry: result.geometry,
    source: result.source,
    computedAt: new Date()
  };
  const $set = { 'tracking.route': route };
  if (!(ride.distanceKm > 0)) $set.distanceKm = Math.round(route.distanceMeters / 10) / 100;
  await Ride.updateOne({ _id: ride._id }, { $set });
  emitToRide(io, rideId, 'tracking:route', { rideId: String(rideId), route });
  return route;
}

// ---------------------------------------------------------------------------
// Driver actions
// ---------------------------------------------------------------------------
async function requireOwnRide(driverId, rideId) {
  if (!mongoose.isValidObjectId(rideId)) throw new TrackingError(400, 'INVALID_RIDE', 'Invalid ride id');
  const ride = await Ride.findById(rideId);
  if (!ride) throw new TrackingError(404, 'RIDE_NOT_FOUND', 'Ride not found');
  if (String(ride.driver) !== String(driverId)) {
    throw new TrackingError(403, 'NOT_AUTHORIZED', 'Only the driver of this ride can do that');
  }
  return ride;
}

function statusPayload(ride, extra = {}) {
  return {
    rideId: String(ride._id),
    rideStatus: ride.status,
    statusLabel: STATUS_LABELS[ride.status],
    trackingState: ride.tracking?.state || 'idle',
    ...extra
  };
}

async function notifyPassengers(ride, title, message) {
  const bookings = await Booking.find({ ride: ride._id, status: 'accepted' }).select('_id passenger');
  if (!bookings.length) return;
  await Notification.insertMany(
    bookings.map((b) => ({
      user: b.passenger,
      type: 'trip_status_update',
      title,
      message,
      relatedRide: ride._id,
      relatedBooking: b._id
    }))
  );
}

async function startRide(driverId, rideId, io) {
  const ride = await requireOwnRide(driverId, rideId);

  if (!['scheduled', 'preparing'].includes(ride.status)) {
    throw new TrackingError(409, 'BAD_STATE', `A ride that is "${ride.status}" cannot be started`);
  }
  const minutesUntil = (new Date(ride.departureTime).getTime() - Date.now()) / 60000;
  if (minutesUntil > cfg.START_WINDOW_MINUTES) {
    throw new TrackingError(
      409,
      'TOO_EARLY',
      `This ride can be started up to ${Math.round(cfg.START_WINDOW_MINUTES / 60)} hour(s) before departure`
    );
  }

  const other = await Ride.findOne({
    driver: driverId,
    _id: { $ne: ride._id },
    'tracking.state': { $in: LIVE_STATES }
  }).select('origin destination');
  if (other) {
    throw new TrackingError(409, 'ANOTHER_RIDE_ACTIVE', 'End your other active ride before starting this one');
  }

  // Atomic guard: only one concurrent request can flip idle -> active.
  const started = await Ride.findOneAndUpdate(
    {
      _id: ride._id,
      driver: driverId,
      status: { $in: ['scheduled', 'preparing'] },
      'tracking.state': { $in: ['idle', null] }
    },
    { $set: { status: 'started', 'tracking.state': 'active', 'tracking.startedAt': new Date() } },
    { new: true }
  );
  if (!started) throw new TrackingError(409, 'ALREADY_STARTED', 'This ride has already been started');

  await RideLocation.deleteOne({ rideId: ride._id });
  await RideLocationPoint.deleteMany({ rideId: ride._id });

  emitToRide(io, ride._id, 'tracking:status', statusPayload(started));
  await notifyPassengers(started, 'Your ride has started', 'Your driver has started the ride. You can now track it live.');
  prepareRoute(ride._id, io).catch((err) => console.warn('[tracking] route prep failed:', err.message));
  return started;
}

async function setPaused(driverId, rideId, io, pause) {
  const from = pause ? 'active' : 'paused';
  const to = pause ? 'paused' : 'active';
  await requireOwnRide(driverId, rideId);

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, 'tracking.state': from },
    { $set: { 'tracking.state': to, 'tracking.pausedAt': pause ? new Date() : null } },
    { new: true }
  );
  if (!ride) {
    throw new TrackingError(409, 'BAD_STATE', pause ? 'Tracking is not active' : 'Tracking is not paused');
  }

  await withRideLock(rideId, async () => {
    // Break the distance chain: movement while paused must not be joined to the
    // first point after resuming (that gap would otherwise be billed as a straight line).
    await RideLocation.updateOne(
      { rideId },
      { $set: { trackingStatus: to, distPoint: null, consecutiveJumps: 0 } }
    );
  });
  emitToRide(io, rideId, 'tracking:status', statusPayload(ride));
  return ride;
}

async function updateProgress(driverId, rideId, step, io) {
  const target = PROGRESS[step];
  if (!target) throw new TrackingError(400, 'INVALID_STATUS', 'Unknown ride status step');
  const ride = await requireOwnRide(driverId, rideId);

  if (!LIVE_STATES.includes(ride.tracking?.state)) {
    throw new TrackingError(409, 'NOT_ACTIVE', 'Start the ride before updating its status');
  }
  if (PROGRESS_ORDER.indexOf(target) <= PROGRESS_ORDER.indexOf(ride.status)) {
    throw new TrackingError(409, 'BAD_STATE', 'The ride has already passed that step');
  }

  const updated = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, status: ride.status, 'tracking.state': { $in: LIVE_STATES } },
    { $set: { status: target } },
    { new: true }
  );
  if (!updated) throw new TrackingError(409, 'BAD_STATE', 'Ride status changed, please refresh');

  emitToRide(io, rideId, 'tracking:status', statusPayload(updated));
  const messages = {
    pickup_in_progress: ['Driver has arrived', 'Your driver has arrived at the pickup point.'],
    on_the_way: ['Ride in progress', 'Your ride is now in progress.'],
    reached: ['Destination reached', 'The vehicle has reached the destination.']
  };
  await notifyPassengers(updated, ...messages[target]);
  return updated;
}

/** Deletes all live location data for a ride (latest point + trail). */
async function purgeLocationData(rideId) {
  await Promise.all([RideLocation.deleteOne({ rideId }), RideLocationPoint.deleteMany({ rideId })]);
}

/** Makes every socket leave the ride's room (used at end / cancel). */
function closeRoom(io, rideId) {
  if (io) io.in(trackRoom(rideId)).socketsLeave(trackRoom(rideId));
}

async function endRide(driverId, rideId, io) {
  await requireOwnRide(driverId, rideId);

  return withRideLock(rideId, async () => {
    // Atomic guard: exactly one request can finalize the ride (no double billing).
    const ride = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        driver: driverId,
        'tracking.state': { $in: LIVE_STATES },
        status: { $in: PROGRESS_ORDER }
      },
      { $set: { status: 'completed', 'tracking.state': 'ended', 'tracking.endedAt': new Date() } },
      { new: true }
    );
    if (!ride) throw new TrackingError(409, 'BAD_STATE', 'This ride is not in progress');

    const loc = await RideLocation.findOne({ rideId });
    const actualMeters = Math.round(loc?.distanceMeters || 0);

    const bookings = await Booking.find({ ride: ride._id, status: 'accepted' });
    const fares = [];
    for (const booking of bookings) {
      const fare = finalizeFare({ ride, booking, actualMeters });
      await Booking.updateOne(
        { _id: booking._id, status: 'accepted' },
        { $set: { status: 'completed', fare, paymentStatus: fare.totalAmount > 0 ? 'pending' : 'not_due' } }
      );
      fares.push({ bookingId: String(booking._id), passengerId: String(booking.passenger), fare });
    }

    await Ride.updateOne(
      { _id: ride._id },
      { $set: { 'tracking.actualDistanceMeters': actualMeters, 'tracking.finalizedAt': new Date() } }
    );
    await User.updateMany(
      { _id: { $in: [...bookings.map((b) => b.passenger), ride.driver] } },
      { $inc: { completedRides: 1 } }
    );
    await Notification.insertMany(
      fares.map(({ bookingId, passengerId, fare }) => ({
        user: passengerId,
        type: 'trip_status_update',
        title: 'Ride completed',
        message: `Your ride is complete. Final fare: ₹${fare.totalAmount} (${fare.basis === 'actual' ? 'based on distance travelled' : 'listed price'}).`,
        relatedRide: ride._id,
        relatedBooking: bookingId
      }))
    );

    // Privacy: location data is deleted the moment the ride is finished.
    await purgeLocationData(ride._id);

    const final = {
      rideId: String(ride._id),
      reason: 'completed',
      actualDistanceKm: Math.round(actualMeters / 10) / 100
    };
    // Each passenger only receives their own fare, over their private user room.
    if (io) {
      for (const { passengerId, fare } of fares) {
        io.to(`user:${passengerId}`).emit('tracking:fare', { rideId: String(ride._id), fare });
      }
    }
    emitToRide(io, ride._id, 'tracking:ended', final);
    closeRoom(io, ride._id);

    return { ride, actualMeters, fares };
  });
}

/**
 * Called when a ride is cancelled (by the driver or an admin). Stops
 * broadcasting immediately and erases location data.
 */
async function handleRideCancelled(rideId, io) {
  await Ride.updateOne({ _id: rideId, 'tracking.state': { $in: [...LIVE_STATES, 'idle', null] } }, {
    $set: { 'tracking.state': 'ended', 'tracking.endedAt': new Date() }
  });
  await purgeLocationData(rideId);
  emitToRide(io, rideId, 'tracking:ended', { rideId: String(rideId), reason: 'ride_cancelled' });
  closeRoom(io, rideId);
}

/** Called when one passenger's booking is cancelled/rejected: cut off only their access. */
function revokePassengerAccess(io, rideId, passengerId, reason = 'booking_cancelled') {
  if (!io) return;
  io.to(`user:${passengerId}`).emit('tracking:ended', { rideId: String(rideId), reason });
  io.in(`user:${passengerId}`).socketsLeave(trackRoom(rideId));
}

// ---------------------------------------------------------------------------
// Location ingestion (socket or HTTP fallback)
// ---------------------------------------------------------------------------
function rejection(code, message, extra = {}) {
  return { accepted: false, code, message, ...extra };
}

function parseTimestamp(value) {
  if (value === undefined || value === null) return Date.now();
  if (typeof value === 'number') return value;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Validates and applies one GPS reading from the ride's driver.
 * Returns { accepted:true, ... } or { accepted:false, code, message }.
 * Throws TrackingError only for authorization / state problems.
 */
async function ingestLocation(driverId, rideId, payload, io) {
  if (!mongoose.isValidObjectId(rideId)) throw new TrackingError(400, 'INVALID_RIDE', 'Invalid ride id');
  const { latitude, longitude } = payload || {};

  // ---- cheap validation first (nothing here touches the database) ----
  if (!isValidLatLng(latitude, longitude) || isNullIsland(latitude, longitude)) {
    return rejection('INVALID_COORDINATES', 'Latitude/longitude are missing or out of range');
  }
  const accuracy = payload.accuracy === undefined || payload.accuracy === null ? null : Number(payload.accuracy);
  if (accuracy !== null && (!isFiniteNumber(accuracy) || accuracy < 0)) {
    return rejection('INVALID_ACCURACY', 'Accuracy must be a non-negative number');
  }
  const timestamp = parseTimestamp(payload.timestamp);
  if (!Number.isFinite(timestamp)) return rejection('INVALID_TIMESTAMP', 'Timestamp is not valid');
  const now = Date.now();
  if (timestamp > now + cfg.MAX_FUTURE_MS) return rejection('INVALID_TIMESTAMP', 'Timestamp is in the future');
  if (now - timestamp > cfg.MAX_STALE_MS) return rejection('STALE', 'Reading is too old and was ignored');
  if (accuracy !== null && accuracy > cfg.MAX_ACCEPT_ACCURACY_M) {
    return rejection('POOR_ACCURACY', `GPS accuracy (${Math.round(accuracy)} m) is too poor to use`);
  }
  const heading = isFiniteNumber(payload.heading) ? payload.heading : undefined;
  const speed = isFiniteNumber(payload.speed) ? payload.speed : undefined;

  return withRideLock(rideId, async () => {
    // ---- authoritative checks against the database ----
    const ride = await Ride.findById(rideId).select('driver status tracking');
    if (!ride) throw new TrackingError(404, 'RIDE_NOT_FOUND', 'Ride not found');
    if (String(ride.driver) !== String(driverId)) {
      throw new TrackingError(403, 'NOT_AUTHORIZED', 'Only the driver of this ride can publish its location');
    }
    if (ride.status === 'cancelled' || ride.status === 'completed' || ride.tracking?.state === 'ended') {
      throw new TrackingError(409, 'RIDE_ENDED', 'This ride has ended - location updates are no longer accepted');
    }
    if (ride.tracking?.state === 'paused') throw new TrackingError(409, 'PAUSED', 'Tracking is paused');
    if (ride.tracking?.state !== 'active') throw new TrackingError(409, 'NOT_STARTED', 'The ride has not been started');

    const prev = await RideLocation.findOne({ rideId });

    if (prev?.timestamp !== undefined && prev.timestamp !== null) {
      if (timestamp === prev.timestamp) return rejection('DUPLICATE', 'Duplicate reading ignored');
      if (timestamp < prev.timestamp) return rejection('OUT_OF_ORDER', 'Older reading ignored');
    }
    if (prev?.receivedAt && now - prev.receivedAt.getTime() < cfg.MIN_UPDATE_INTERVAL_MS) {
      return rejection('THROTTLED', 'Updates are arriving too fast', { retryAfterMs: cfg.MIN_UPDATE_INTERVAL_MS });
    }

    // ---- distance accounting ----
    const point = { lat: latitude, lng: longitude, ts: timestamp };
    const goodForDistance = accuracy === null ? false : accuracy <= cfg.DISTANCE_MAX_ACCURACY_M;
    let addMeters = 0;
    let counted = false;
    let newDistPoint = prev?.distPoint || null;
    let jumps = prev?.consecutiveJumps || 0;
    let skipReason = null;

    if (!goodForDistance) {
      skipReason = 'low_accuracy'; // still shown on the map, just never billed
    } else if (!newDistPoint) {
      newDistPoint = point; // first reliable fix (or first after pause): baseline only
      jumps = 0;
      skipReason = 'baseline';
    } else {
      const segment = haversineMeters(newDistPoint, point);
      const seconds = (timestamp - newDistPoint.ts) / 1000;
      const speedMps = seconds > 0 ? segment / seconds : Infinity;

      if (speedMps > cfg.MAX_SPEED_MPS) {
        jumps += 1;
        skipReason = 'implausible_jump';
        if (jumps >= cfg.MAX_CONSECUTIVE_JUMPS) {
          // Repeated "jumps" mean our baseline was the bad point: re-baseline, add nothing.
          newDistPoint = point;
          jumps = 0;
        }
      } else if (segment < cfg.MIN_SEGMENT_M) {
        jumps = 0;
        skipReason = 'below_noise_floor'; // baseline stays put so slow drift can still accumulate
      } else {
        addMeters = segment;
        counted = true;
        newDistPoint = point;
        jumps = 0;
      }
    }

    // A reading that looks like a teleport is not shown either.
    if (skipReason === 'implausible_jump' && jumps !== 0) {
      await RideLocation.updateOne({ rideId }, { $set: { consecutiveJumps: jumps }, $inc: { rejectedCount: 1 } });
      return rejection('IMPLAUSIBLE_JUMP', 'Location jumped an implausible distance and was ignored');
    }

    const $set = {
      driverId,
      latitude,
      longitude,
      timestamp,
      receivedAt: new Date(now),
      trackingStatus: 'active',
      distPoint: newDistPoint,
      consecutiveJumps: jumps
    };
    const $unset = {};
    // Optional sensor fields: set when present, clear when absent so stale values never linger.
    for (const [key, value] of Object.entries({ accuracy, heading, speed })) {
      if (value === null || value === undefined) $unset[key] = '';
      else $set[key] = value;
    }
    const update = { $set, $inc: { distanceMeters: addMeters, acceptedCount: 1 } };
    if (Object.keys($unset).length) update.$unset = $unset;
    // Conditional on the previous timestamp so a racing writer can never rewind the record.
    const filter = prev ? { rideId, timestamp: prev.timestamp } : { rideId };
    const saved = await RideLocation.findOneAndUpdate(filter, update, { new: true, upsert: !prev });
    if (!saved) return rejection('OUT_OF_ORDER', 'A newer reading was already stored');

    // ---- sampled history (NOT one row per fix) ----
    const last = saved.lastStoredPoint;
    const movedEnough = !last || haversineMeters(last, point) >= cfg.HISTORY_MIN_MOVE_M;
    const waitedEnough = !last || timestamp - last.ts >= cfg.HISTORY_MIN_INTERVAL_MS;
    if (movedEnough || waitedEnough) {
      await RideLocationPoint.create({
        rideId,
        latitude,
        longitude,
        accuracy: accuracy === null ? undefined : accuracy,
        timestamp,
        expireAt: new Date(now + cfg.HISTORY_TTL_HOURS * 3600 * 1000)
      });
      await RideLocation.updateOne({ rideId }, { $set: { lastStoredPoint: point } });
    }

    const broadcast = {
      rideId: String(rideId),
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      timestamp,
      distanceMeters: Math.round(saved.distanceMeters),
      trackingStatus: 'active'
    };
    emitToRide(io, rideId, 'tracking:location', broadcast);

    return {
      accepted: true,
      counted,
      skipReason,
      distanceMeters: Math.round(saved.distanceMeters),
      timestamp
    };
  });
}

// ---------------------------------------------------------------------------
// Snapshot + ETA (REST reads)
// ---------------------------------------------------------------------------
function publicPoint(p) {
  const c = coordsOf(p);
  return c ? { label: p.label, lat: c.lat, lng: c.lng } : { label: p?.label };
}

function pickupFor(ride, booking) {
  const points = ride.pickupPoints || [];
  const chosen = booking?.pickupPointId ? points.find((p) => String(p._id) === String(booking.pickupPointId)) : null;
  return chosen || points[0] || ride.origin;
}

async function getSnapshot(userId, rideId) {
  const ctx = await authorizeParticipant(userId, rideId);
  const { ride, role, booking } = ctx;

  if (ride.status !== 'cancelled' && ride.tracking?.state !== 'ended') await ensureCoordinates(ride);

  const state = ride.tracking?.state || 'idle';
  const live = LIVE_STATES.includes(state) && canSeeLive(ctx);
  const loc = live ? await RideLocation.findOne({ rideId: ride._id }) : null;

  let trail = [];
  if (live && loc) {
    const pts = await RideLocationPoint.find({ rideId: ride._id })
      .sort({ timestamp: -1 })
      .limit(cfg.TRAIL_MAX_POINTS)
      .select('latitude longitude timestamp');
    trail = pts.reverse().map((p) => [p.latitude, p.longitude]);
  }

  const seats = booking?.seatsRequested || 1;
  const driver = ride.driver;
  const finished = ride.status === 'completed';

  const snapshot = {
    role,
    ride: {
      id: String(ride._id),
      status: ride.status,
      statusLabel: STATUS_LABELS[ride.status],
      departureTime: ride.departureTime,
      origin: publicPoint(ride.origin),
      destination: publicPoint(ride.destination),
      fareBasis: ride.fareBasis || 'estimated',
      fareMode: ride.fareMode || 'manual'
    },
    tracking: {
      state,
      startedAt: ride.tracking?.startedAt || null,
      endedAt: ride.tracking?.endedAt || null,
      route: ride.tracking?.route?.geometry
        ? {
            geometry: ride.tracking.route.geometry,
            distanceMeters: ride.tracking.route.distanceMeters,
            durationSec: ride.tracking.route.durationSec
          }
        : null,
      plannedDistanceKm: plannedDistanceKm(ride) || null,
      // Actual distance is only reported while live or once finalized - never invented.
      actualDistanceKm: live
        ? Math.round((loc?.distanceMeters || 0) / 10) / 100
        : finished && ride.tracking?.actualDistanceMeters !== undefined
          ? Math.round(ride.tracking.actualDistanceMeters / 10) / 100
          : null,
      location: loc && isFiniteNumber(loc.latitude)
        ? {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy ?? null,
            heading: loc.heading ?? null,
            speed: loc.speed ?? null,
            timestamp: loc.timestamp
          }
        : null,
      trail
    },
    driver: {
      id: String(driver._id),
      name: driver.name,
      avatarColor: driver.avatarColor,
      isVerified: driver.isVerified,
      ratingAverage: driver.ratingAverage,
      ratingCount: driver.ratingCount,
      vehicle: driver.vehicle || null,
      // Contact number is only shared with passengers holding a confirmed/completed booking.
      phone: role === 'passenger' ? driver.phone || null : undefined
    },
    fare: {
      estimated: estimateFare(ride, seats, booking),
      // Only the caller's own booking fare is ever returned.
      final: booking?.fare?.finalizedAt ? booking.fare : null,
      agreedToDistanceBilling: booking ? !!booking.acceptedDistanceBilling : undefined
    }
  };

  if (role === 'passenger') {
    snapshot.pickup = publicPoint(pickupFor(ride, booking));
    snapshot.booking = { id: String(booking._id), status: booking.status, seats };
  } else {
    const bookings = await Booking.find({ ride: ride._id, status: { $in: ['accepted', 'completed'] } })
      .populate('passenger', 'name phone avatarColor');
    snapshot.passengers = bookings.map((b) => ({
      bookingId: String(b._id),
      name: b.passenger?.name,
      phone: b.passenger?.phone,
      seats: b.seatsRequested,
      pickup: publicPoint(pickupFor(ride, b)),
      bookingStatus: b.status
    }));
    snapshot.seatsBooked = bookings.reduce((n, b) => n + b.seatsRequested, 0);
  }
  return snapshot;
}

const etaCache = new Map();

async function getEta(userId, rideId) {
  const ctx = await authorizeParticipant(userId, rideId);
  const { ride, role, booking } = ctx;

  if (!canSeeLive(ctx) || !LIVE_STATES.includes(ride.tracking?.state)) {
    return { available: false, reason: 'not_tracking', message: 'The ride is not being tracked right now.' };
  }
  const loc = await RideLocation.findOne({ rideId: ride._id });
  if (!loc || !isFiniteNumber(loc.latitude)) {
    return { available: false, reason: 'no_location', message: 'Waiting for the first location from the driver.' };
  }

  const toPickup = role === 'passenger' && ride.status === 'started';
  const target = toPickup ? coordsOf(pickupFor(ride, booking)) : coordsOf(ride.destination);
  const targetName = toPickup ? 'pickup' : 'destination';
  if (!target) {
    return { available: false, reason: 'no_target', message: 'The destination coordinates are not available yet.' };
  }

  const from = { lat: loc.latitude, lng: loc.longitude };
  const straightLineMeters = Math.round(haversineMeters(from, target));

  const key = `${ride._id}:${targetName}`;
  const cached = etaCache.get(key);
  if (cached && cached.expires > Date.now()) return { ...cached.value, cached: true };

  const result = await routing.getRoute([from, target], { cacheMs: cfg.ETA_CACHE_MS });
  let value;
  if (result.ok) {
    value = {
      available: true,
      target: targetName,
      remainingMeters: Math.round(result.distanceMeters),
      durationSec: Math.round(result.durationSec),
      arrivalAt: new Date(Date.now() + result.durationSec * 1000).toISOString(),
      straightLineMeters,
      note: 'Estimated from the road network without live traffic.'
    };
  } else {
    value = {
      available: false,
      target: targetName,
      reason: result.reason,
      message: 'A reliable arrival time is not available right now.',
      straightLineMeters
    };
  }
  etaCache.set(key, { value, expires: Date.now() + cfg.ETA_CACHE_MS });
  if (etaCache.size > 200) etaCache.delete(etaCache.keys().next().value);
  return value;
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------
/**
 * Rides whose driver silently vanished (closed the app, battery died, ...) are
 * auto-paused after ABANDON_MINUTES without an update so they don't stay "live" forever.
 */
async function sweepAbandonedTracking(io) {
  const cutoff = new Date(Date.now() - cfg.ABANDON_MINUTES * 60000);
  const rides = await Ride.find({ 'tracking.state': 'active', 'tracking.startedAt': { $lt: cutoff } }).select('_id driver');
  let paused = 0;
  for (const ride of rides) {
    const loc = await RideLocation.findOne({ rideId: ride._id }).select('receivedAt');
    const lastSeen = loc?.receivedAt || null;
    if (lastSeen && lastSeen > cutoff) continue;
    try {
      await setPaused(ride.driver, ride._id, io, true);
      await Notification.create({
        user: ride.driver,
        type: 'trip_status_update',
        title: 'Tracking paused automatically',
        message: 'No location updates were received for a long time, so live tracking was paused. Open the ride to resume or end it.',
        relatedRide: ride._id
      });
      paused += 1;
    } catch (err) {
      /* ride changed state concurrently - ignore */
    }
  }
  return paused;
}

module.exports = {
  TrackingError,
  STATUS_LABELS,
  LIVE_STATES,
  trackRoom,
  authorizeParticipant,
  canSeeLive,
  startRide,
  setPaused,
  updateProgress,
  endRide,
  handleRideCancelled,
  revokePassengerAccess,
  ingestLocation,
  getSnapshot,
  getEta,
  prepareRoute,
  sweepAbandonedTracking
};
