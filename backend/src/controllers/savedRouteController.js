const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const SavedRoute = require('../models/SavedRoute');

const getMySavedRoutes = asyncHandler(async (req, res) => {
  const routes = await SavedRoute.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: routes.length, routes });
});

const createSavedRoute = asyncHandler(async (req, res) => {
  const { label, origin, destination, preferredTime, flexibleMinutes } = req.body;
  if (!label || !origin || !destination) throw new ApiError(400, 'label, origin and destination are required');

  const route = await SavedRoute.create({
    user: req.user._id, label, origin, destination, preferredTime, flexibleMinutes
  });
  res.status(201).json({ success: true, route });
});

const updateSavedRoute = asyncHandler(async (req, res) => {
  const route = await SavedRoute.findById(req.params.id);
  if (!route) throw new ApiError(404, 'Saved route not found');
  if (String(route.user) !== String(req.user._id)) throw new ApiError(403, 'Not authorized');

  Object.assign(route, req.body);
  await route.save();
  res.json({ success: true, route });
});

const deleteSavedRoute = asyncHandler(async (req, res) => {
  const route = await SavedRoute.findById(req.params.id);
  if (!route) throw new ApiError(404, 'Saved route not found');
  if (String(route.user) !== String(req.user._id)) throw new ApiError(403, 'Not authorized');

  await route.deleteOne();
  res.json({ success: true, message: 'Saved route deleted' });
});

module.exports = { getMySavedRoutes, createSavedRoute, updateSavedRoute, deleteSavedRoute };
