const mongoose = require('mongoose');

/**
 * The LATEST known location of a ride in progress - exactly one document per
 * ride (unique rideId), updated in place. It also carries the server-side,
 * authoritative distance accumulator so clients can never set it.
 * The document is deleted when the ride ends or is cancelled.
 */
const pointSchema = new mongoose.Schema(
  { lat: Number, lng: Number, ts: Number },
  { _id: false }
);

const rideLocationSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, unique: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    heading: { type: Number },
    speed: { type: Number },
    timestamp: { type: Number }, // device time (ms epoch) of the latest ACCEPTED reading
    receivedAt: { type: Date }, // server time of the latest accepted reading (used for throttling)
    trackingStatus: { type: String, enum: ['active', 'paused', 'ended'], default: 'active' },

    // ---- server-authoritative distance accounting ----
    distanceMeters: { type: Number, default: 0 },
    distPoint: { type: pointSchema, default: null }, // last reading that counted toward distance
    consecutiveJumps: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    lastStoredPoint: { type: pointSchema, default: null } // last point copied to history
  },
  { timestamps: true }
);

module.exports = mongoose.model('RideLocation', rideLocationSchema);
