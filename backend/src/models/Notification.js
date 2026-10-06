const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'booking_accepted', 'booking_rejected', 'booking_requested',
        'waitlist_seat_available', 'ride_reminder', 'ride_cancelled',
        'trip_status_update', 'lost_item_report', 'safety_report_update'
      ],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    relatedLostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'LostItem' },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
