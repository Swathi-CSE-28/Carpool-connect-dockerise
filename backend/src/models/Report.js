const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    category: {
      type: String,
      enum: ['safety_concern', 'harassment', 'reckless_driving', 'no_show', 'other'],
      default: 'other'
    },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['open', 'under_review', 'resolved', 'dismissed'], default: 'open' },
    adminNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

reportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', reportSchema);
