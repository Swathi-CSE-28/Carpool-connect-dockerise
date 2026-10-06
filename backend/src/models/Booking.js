const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickupPointId: { type: mongoose.Schema.Types.ObjectId },
    seatsRequested: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending'
    },
    respondedAt: { type: Date },

    // Passenger's explicit consent to distance-based billing (required when the
    // ride's fareBasis is 'actual'). Without it they are always billed the listed price.
    acceptedDistanceBilling: { type: Boolean, default: false },

    // Per-seat price the passenger was quoted for THEIR pickup point when booking (snapshot, so later
    // ride edits can't change what they agreed to). Set by the server.
    quotedPerSeat: { type: Number },

    // Written once by the server when the ride ends. Clients can never set this.
    fare: {
      currency: { type: String, default: 'INR' },
      basis: { type: String, enum: ['estimated', 'actual'] }, // what was actually applied
      basisReason: { type: String }, // why (e.g. policy, passenger did not agree, no GPS data)
      seats: Number,
      plannedDistanceKm: Number,
      actualDistanceKm: Number,
      ratePerKm: Number,
      perSeatAmount: Number,
      totalAmount: Number,
      capped: { type: Boolean, default: false },
      finalizedAt: Date
    },
    // No payment gateway exists in this project yet; this is the hook a payment module reads.
    paymentStatus: { type: String, enum: ['not_due', 'pending', 'paid'], default: 'not_due' }
  },
  { timestamps: true }
);

// A passenger can only have one active (pending/accepted) booking per ride
bookingSchema.index({ ride: 1, passenger: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
