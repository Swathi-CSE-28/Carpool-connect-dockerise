const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const LostItem = require('../models/LostItem');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');

// POST /api/lost-items (driver only, must own the ride)
const createLostItem = asyncHandler(async (req, res) => {
  const { rideId, itemDescription, foundLocation } = req.body;
  if (!rideId || !itemDescription || !foundLocation) {
    throw new ApiError(400, 'rideId, itemDescription and foundLocation are required');
  }

  const ride = await Ride.findById(rideId);
  if (!ride) throw new ApiError(404, 'Ride not found');
  if (String(ride.driver) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the ride driver can create a lost-item report for this ride');
  }

  const lostItem = await LostItem.create({
    ride: rideId,
    reportedBy: req.user._id,
    itemDescription,
    foundLocation,
    status: 'open'
  });

  // Notify only participants (accepted bookings) of THIS ride — never unrelated users
  const participants = await Booking.find({ ride: rideId, status: 'accepted' }).select('passenger');
  await Promise.all(
    participants.map((p) =>
      Notification.create({
        user: p.passenger,
        type: 'lost_item_report',
        title: 'Lost item reported',
        message: `An item was found on your recent ride: "${itemDescription}". Check if it's yours.`,
        relatedRide: ride._id,
        relatedLostItem: lostItem._id
      })
    )
  );

  res.status(201).json({ success: true, lostItem });
});

// GET /api/lost-items/ride/:rideId — only the driver or an accepted participant may view
const getLostItemsForRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findById(req.params.rideId);
  if (!ride) throw new ApiError(404, 'Ride not found');

  const isDriver = String(ride.driver) === String(req.user._id);
  const isParticipant = await Booking.findOne({
    ride: ride._id,
    passenger: req.user._id,
    status: 'accepted'
  });

  if (!isDriver && !isParticipant && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only ride participants can view lost-item reports for this ride');
  }

  const items = await LostItem.find({ ride: ride._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: items.length, items });
});

// GET /api/lost-items/:id
const getLostItemById = asyncHandler(async (req, res) => {
  const item = await LostItem.findById(req.params.id).populate('ride');
  if (!item) throw new ApiError(404, 'Lost item report not found');

  const isDriver = String(item.ride.driver) === String(req.user._id);
  const isParticipant = await Booking.findOne({ ride: item.ride._id, passenger: req.user._id, status: 'accepted' });

  if (!isDriver && !isParticipant && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this report');
  }

  res.json({ success: true, item });
});

// PATCH /api/lost-items/:id/status (driver or admin)
const updateLostItemStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const item = await LostItem.findById(req.params.id).populate('ride');
  if (!item) throw new ApiError(404, 'Lost item report not found');

  if (String(item.ride.driver) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the reporting driver can update this report');
  }

  item.status = status;
  await item.save();
  res.json({ success: true, item });
});

// POST /api/lost-items/:id/claim (passenger: "this is my item")
const claimLostItem = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const item = await LostItem.findById(req.params.id).populate('ride');
  if (!item) throw new ApiError(404, 'Lost item report not found');

  const isParticipant = await Booking.findOne({ ride: item.ride._id, passenger: req.user._id, status: 'accepted' });
  if (!isParticipant) throw new ApiError(403, 'Only ride participants can submit a claim');

  item.claims.push({ claimedBy: req.user._id, message });
  item.status = 'claimed';
  await item.save();

  await Notification.create({
    user: item.reportedBy,
    type: 'lost_item_report',
    title: 'New claim on lost item',
    message: `${req.user.name} claimed the lost item: "${item.itemDescription}".`,
    relatedRide: item.ride._id,
    relatedLostItem: item._id
  });

  res.json({ success: true, item });
});

module.exports = { createLostItem, getLostItemsForRide, getLostItemById, updateLostItemStatus, claimLostItem };
