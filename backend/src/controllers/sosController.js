const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const SOSAlert = require('../models/SOSAlert');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { broadcastSOS } = require('../sockets');

// POST /api/sos - any authenticated user can raise a panic alert
const triggerSOS = asyncHandler(async (req, res) => {
  const { rideId, lat, lng, label, message } = req.body;

  const alert = await SOSAlert.create({
    user: req.user._id,
    ride: rideId || undefined,
    location: { lat, lng, label },
    message: message || 'Emergency SOS triggered from the app'
  });

  await alert.populate('user', 'name phone avatarColor role');
  if (alert.ride) await alert.populate('ride', 'origin destination');

  // Push to every connected admin instantly; the DB record is the source of
  // truth so a dashboard that (re)loads later still sees it via GET /api/sos.
  const io = req.app.get('io');
  if (io) broadcastSOS(io, alert);

  // Also drop a persistent notification for every admin so it's visible
  // even outside the live dashboard (e.g. in their notification bell).
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      type: 'safety_report_update',
      title: 'SOS Alert',
      message: `${req.user.name} triggered an emergency SOS alert.`,
      relatedRide: alert.ride?._id
    }))
  );

  res.status(201).json({ success: true, alert });
});

// GET /api/sos/mine - the caller's own SOS history
const getMyAlerts = asyncHandler(async (req, res) => {
  const alerts = await SOSAlert.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: alerts.length, alerts });
});

// GET /api/sos - admin: all non-resolved alerts first, most recent first
const getActiveAlerts = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = status ? { status } : { status: { $in: ['active', 'acknowledged'] } };
  const alerts = await SOSAlert.find(query)
    .populate('user', 'name phone avatarColor role')
    .populate('ride', 'origin destination departureTime')
    .populate('acknowledgedBy', 'name')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: alerts.length, alerts });
});

// PATCH /api/sos/:id/acknowledge - admin
const acknowledgeAlert = asyncHandler(async (req, res) => {
  const alert = await SOSAlert.findById(req.params.id);
  if (!alert) throw new ApiError(404, 'SOS alert not found');

  alert.status = 'acknowledged';
  alert.acknowledgedBy = req.user._id;
  alert.acknowledgedAt = new Date();
  await alert.save();

  const io = req.app.get('io');
  if (io) broadcastSOS(io, alert, 'sos:update');

  res.json({ success: true, alert });
});

// PATCH /api/sos/:id/resolve - admin
const resolveAlert = asyncHandler(async (req, res) => {
  const alert = await SOSAlert.findById(req.params.id);
  if (!alert) throw new ApiError(404, 'SOS alert not found');

  alert.status = 'resolved';
  alert.resolvedAt = new Date();
  if (req.body.resolutionNotes) alert.resolutionNotes = req.body.resolutionNotes;
  await alert.save();

  const io = req.app.get('io');
  if (io) broadcastSOS(io, alert, 'sos:update');

  res.json({ success: true, alert });
});

module.exports = { triggerSOS, getMyAlerts, getActiveAlerts, acknowledgeAlert, resolveAlert };
