const mongoose = require('mongoose');

const pickupPointSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    lat: { type: Number },
    lng: { type: Number },
    order: { type: Number, default: 0 },
    approxTime: { type: String }, // e.g. "08:10 AM"
    // Set by the server for fareMode "auto": road distance from this stop to the destination and the fare for boarding here
    distanceToDestKm: { type: Number },
    fare: { type: Number }
  },
  { _id: true }
);

const rideSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    origin: {
      label: { type: String, required: true },
      lat: Number,
      lng: Number
    },
    destination: {
      label: { type: String, required: true },
      lat: Number,
      lng: Number
    },
    pickupPoints: [pickupPointSchema],
    departureTime: { type: Date, required: true },
    flexibleMinutes: { type: Number, default: 0 }, // +/- flexibility window
    totalSeats: { type: Number, required: true, min: 1 },
    seatsAvailable: { type: Number, required: true, min: 0 },
    pricePerSeat: { type: Number, default: 0 },
    womenOnly: { type: Boolean, default: false },
    preferences: {
      music: { type: Boolean, default: false },
      smoking: { type: Boolean, default: false },
      pets: { type: Boolean, default: false },
      luggage: { type: Boolean, default: true },
      conversation: { type: String, enum: ['chatty', 'quiet', 'no_preference'], default: 'no_preference' }
    },
    status: {
      type: String,
      enum: ['scheduled', 'preparing', 'started', 'pickup_in_progress', 'on_the_way', 'reached', 'completed', 'cancelled'],
      default: 'scheduled'
    },
    distanceKm: { type: Number, default: 0 }, // estimated only
    notes: { type: String, trim: true },

    // Billing policy, fixed at creation. 'estimated' = passengers always pay the
    // listed price. 'actual' = price scales with GPS distance actually travelled,
    // but ONLY for passengers who explicitly agreed when booking (see Booking).
    fareBasis: { type: String, enum: ['estimated', 'actual'], default: 'estimated' },

    // How pricePerSeat/distanceKm were set. 'auto' = computed by the server from the OSRM road route
    // (base + rate x km, see services/fareQuoteService.js); 'manual' = typed in by the driver.
    fareMode: { type: String, enum: ['manual', 'auto'], default: 'manual' },

    // Live tracking state. Only the tracking service writes this - never the client.
    tracking: {
      state: { type: String, enum: ['idle', 'active', 'paused', 'ended'], default: 'idle' },
      startedAt: Date,
      pausedAt: Date,
      endedAt: Date,
      // Planned road route (from the routing service) computed when the ride starts.
      route: {
        distanceMeters: Number,
        durationSec: Number,
        geometry: String, // encoded polyline (precision 5)
        source: String,
        computedAt: Date
      },
      // Final, server-measured distance - written once, when the ride ends.
      actualDistanceMeters: Number,
      finalizedAt: Date
    }
  },
  { timestamps: true }
);

rideSchema.index({ 'origin.label': 'text', 'destination.label': 'text' });
rideSchema.index({ departureTime: 1 });
rideSchema.index({ womenOnly: 1 });
rideSchema.index({ driver: 1 });
rideSchema.index({ status: 1 });
rideSchema.index({ driver: 1, 'tracking.state': 1 });

module.exports = mongoose.model('Ride', rideSchema);
