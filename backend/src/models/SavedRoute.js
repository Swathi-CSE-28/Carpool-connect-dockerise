const mongoose = require('mongoose');

const savedRouteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, required: true, trim: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    preferredTime: { type: String }, // "08:00"
    flexibleMinutes: { type: Number, default: 30 }
  },
  { timestamps: true }
);

savedRouteSchema.index({ user: 1 });

module.exports = mongoose.model('SavedRoute', savedRouteSchema);
