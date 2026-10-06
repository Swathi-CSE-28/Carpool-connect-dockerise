const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Report = require('../models/Report');
const Notification = require('../models/Notification');

// POST /api/reports (any authenticated user)
const createReport = asyncHandler(async (req, res) => {
  const { reportedUserId, rideId, category, description } = req.body;
  if (!description) throw new ApiError(400, 'A description of the concern is required');

  const report = await Report.create({
    reportedBy: req.user._id,
    reportedUser: reportedUserId,
    ride: rideId,
    category: category || 'other',
    description
  });

  res.status(201).json({ success: true, report });
});

const getMyReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ reportedBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: reports.length, reports });
});

module.exports = { createReport, getMyReports };
