const mongoose = require('mongoose');

/**
 * Sampled breadcrumb trail for a ride IN PROGRESS (used to redraw the path
 * travelled so far when a passenger opens/reloads the tracking page).
 *
 * Retention policy:
 *  - points are only stored when the vehicle moved >= HISTORY_MIN_MOVE_M or
 *    HISTORY_MIN_INTERVAL_MS elapsed, so this is NOT one row per GPS fix;
 *  - every point is deleted when the ride ends or is cancelled;
 *  - a TTL index on expireAt is a backstop for rides that never end cleanly.
 * The trail is never returned once a ride has finished.
 */
const rideLocationPointSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number },
  timestamp: { type: Number, required: true },
  expireAt: { type: Date, required: true }
});

rideLocationPointSchema.index({ rideId: 1, timestamp: 1 });
rideLocationPointSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RideLocationPoint', rideLocationPointSchema);
