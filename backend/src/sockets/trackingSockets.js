const tracking = require('../services/trackingService');
const cfg = require('../config/tracking');

/**
 * Socket.IO events for live tracking. Every handler answers through an
 * acknowledgement callback: { ok:true, ... } or { ok:false, code, message }.
 *
 *  client -> server
 *    tracking:subscribe   { rideId }                       driver or confirmed passenger
 *    tracking:unsubscribe { rideId }
 *    tracking:location    { rideId, latitude, longitude, accuracy?, heading?, speed?, timestamp? }   driver only
 *
 *  server -> client (room track:<rideId>)
 *    tracking:location    latest accepted reading + server-measured distance
 *    tracking:status      ride status / tracking state changed
 *    tracking:route       planned route became available
 *    tracking:ended       ride completed / cancelled / your booking was cancelled
 *  server -> client (private user:<id> room)
 *    tracking:fare        the recipient's own finalized fare
 */
const MAX_ROOMS_PER_SOCKET = 5;

const fail = (err) => ({
  ok: false,
  code: err.code || 'ERROR',
  message: err.statusCode && err.statusCode < 500 ? err.message : 'Something went wrong on our end'
});

function initTrackingSockets(io, socket) {
  socket.data.trackingRooms = new Set();
  socket.data.lastLocationAt = 0;

  socket.on('tracking:subscribe', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const rideId = payload?.rideId;
      const ctx = await tracking.authorizeParticipant(socket.userId, rideId);
      if (!tracking.canSeeLive(ctx)) {
        return reply({ ok: false, code: 'RIDE_ENDED', message: 'This ride is no longer being tracked' });
      }
      if (!socket.data.trackingRooms.has(String(rideId)) && socket.data.trackingRooms.size >= MAX_ROOMS_PER_SOCKET) {
        return reply({ ok: false, code: 'TOO_MANY_SUBSCRIPTIONS', message: 'Too many active tracking subscriptions' });
      }
      await socket.join(tracking.trackRoom(rideId));
      socket.data.trackingRooms.add(String(rideId));
      return reply({ ok: true, role: ctx.role, trackingState: ctx.ride.tracking?.state || 'idle' });
    } catch (err) {
      return reply(fail(err));
    }
  });

  socket.on('tracking:unsubscribe', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const rideId = String(payload?.rideId || '');
    if (rideId) {
      await socket.leave(tracking.trackRoom(rideId));
      socket.data.trackingRooms.delete(rideId);
    }
    reply({ ok: true });
  });

  socket.on('tracking:location', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const now = Date.now();
      if (now - socket.data.lastLocationAt < cfg.MIN_UPDATE_INTERVAL_MS) {
        return reply({ ok: false, code: 'THROTTLED', message: 'Updates are arriving too fast', retryAfterMs: cfg.MIN_UPDATE_INTERVAL_MS });
      }
      socket.data.lastLocationAt = now;

      if (socket.userRole !== 'driver') {
        return reply({ ok: false, code: 'NOT_AUTHORIZED', message: 'Only drivers can publish location' });
      }
      const result = await tracking.ingestLocation(socket.userId, payload?.rideId, payload, io);
      return reply({ ok: result.accepted, ...result });
    } catch (err) {
      return reply(fail(err));
    }
  });
}

module.exports = { initTrackingSockets };
