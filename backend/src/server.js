require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { initSockets } = require('./sockets');
const cfg = require('./config/tracking');
const { sweepAbandonedTracking } = require('./services/trackingService');

require('./config/auth').assertJwtSecret(); // refuse to boot with a missing/weak secret in production

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' },
  maxHttpBufferSize: 1e5 // location payloads are tiny; reject anything large
});

initSockets(io);
app.set('io', io); // controllers/services can access via req.app.get('io')

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] CarPool Connect API listening on port ${PORT}`);
  });

  // Auto-pause tracking for rides whose driver stopped sending updates.
  setInterval(() => {
    sweepAbandonedTracking(io).catch((err) => console.warn('[tracking] sweep failed:', err.message));
  }, cfg.SWEEP_INTERVAL_MS).unref();
});

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});
