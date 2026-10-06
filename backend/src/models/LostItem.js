const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // must be the ride's driver
    itemDescription: { type: String, required: true, trim: true },
    foundLocation: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'claimed', 'returned', 'closed'], default: 'open' },
    claims: [
      {
        claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

lostItemSchema.index({ ride: 1 });
lostItemSchema.index({ status: 1 });

module.exports = mongoose.model('LostItem', lostItemSchema);
