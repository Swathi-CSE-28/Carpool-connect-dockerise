const { verifyAccessToken } = require('../utils/generateToken');
const User = require('../models/User');
const { initTrackingSockets } = require('./trackingSockets');

/**
 * Minimal Socket.IO layer for live-style delivery of things that already
 * exist as persistent REST resources (notifications, trip status).
 * REST is the source of truth; sockets just push a "refresh" signal.
 */
function initSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(token);
      // Same checks as the REST middleware: account still active, session not ended.
      const user = await User.findById(decoded.id).select('role isActive tokenVersion');
      if (!user || !user.isActive || (decoded.tv ?? 0) !== (user.tokenVersion || 0)) {
        return next(new Error('Invalid token'));
      }
      socket.userId = String(user._id);
      socket.userRole = user.role; // taken from the database, not from the token
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Each user gets a private room keyed by their own id
    socket.join(`user:${socket.userId}`);

    // Admins also join a shared "admins" room so any of them can receive
    // live SOS alerts the moment they're triggered, without polling.
    if (socket.userRole === 'admin') socket.join('admins');

    // Live GPS tracking: authorized, ride-specific rooms (see trackingSockets.js)
    initTrackingSockets(io, socket);

    socket.on('disconnect', () => {
      // no-op; room membership is cleaned up automatically
    });
  });
}

// Helper other modules can import to push a live event to one user
function notifyUser(io, userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

// Helper to push a trip status update to everyone tied to a ride
function broadcastRideUpdate(io, rideId, payload) {
  io.to(`ride:${rideId}`).emit('trip_status_update', payload);
}

// Pushes an SOS alert (new or updated) to every connected admin in real time.
function broadcastSOS(io, alert, event = 'sos:new') {
  io.to('admins').emit(event, alert);
}

module.exports = { initSockets, notifyUser, broadcastRideUpdate, broadcastSOS };
