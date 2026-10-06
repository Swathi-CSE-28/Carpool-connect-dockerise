const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    position: { type: Number, required: true },
    status: { type: String, enum: ['waiting', 'promoted', 'removed'], default: 'waiting' }
  },
  { timestamps: true }
);

waitlistSchema.index({ ride: 1, passenger: 1 }, { unique: true });
waitlistSchema.index({ ride: 1, position: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
