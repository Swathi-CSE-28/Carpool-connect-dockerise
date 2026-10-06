const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 }
  },
  { timestamps: true }
);

// Prevent duplicate reviews for the same completed ride + reviewer + reviewee
reviewSchema.index({ ride: 1, reviewer: 1, reviewee: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
