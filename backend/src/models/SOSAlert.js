const mongoose = require('mongoose');

/**
 * Persisted record of a panic-button trigger. This backs the app's flagship
 * safety feature: a rider or driver in an active trip can raise an SOS that
 * is pushed to every connected admin in real time over Socket.IO, in addition
 * to being stored here so it survives refreshes/reconnects and can be audited.
 */
const sosAlertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    location: {
      lat: Number,
      lng: Number,
      label: { type: String, trim: true }
    },
    message: { type: String, trim: true, default: 'Emergency SOS triggered from the app' },
    status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

sosAlertSchema.index({ status: 1, createdAt: -1 });
sosAlertSchema.index({ user: 1 });

module.exports = mongoose.model('SOSAlert', sosAlertSchema);
