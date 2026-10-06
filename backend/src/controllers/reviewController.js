const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');

const createReview = asyncHandler(async (req, res) => {
  const { rideId, revieweeId, rating, comment } = req.body;
  if (!rideId || !revieweeId || !rating) throw new ApiError(400, 'rideId, revieweeId and rating are required');

  const ride = await Ride.findById(rideId);
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (ride.status !== 'completed') throw new ApiError(400, 'You can only review completed rides');

  // reviewer must have actually participated in this ride (as driver or accepted passenger)
  const isDriver = String(ride.driver) === String(req.user._id);
  const wasPassenger = await Booking.findOne({ ride: rideId, passenger: req.user._id, status: { $in: ['accepted', 'completed'] } });
  if (!isDriver && !wasPassenger) throw new ApiError(403, 'You did not participate in this ride');

  const review = await Review.create({
    ride: rideId,
    reviewer: req.user._id,
    reviewee: revieweeId,
    rating,
    comment
  });

  // recompute reviewee's average rating
  const allReviews = await Review.find({ reviewee: revieweeId });
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  await User.findByIdAndUpdate(revieweeId, {
    ratingAverage: Math.round(avg * 10) / 10,
    ratingCount: allReviews.length
  });

  res.status(201).json({ success: true, review });
});

const getReviewsForUser = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ reviewee: req.params.userId })
    .populate('reviewer', 'name avatarColor')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: reviews.length, reviews });
});

module.exports = { createReview, getReviewsForUser };
