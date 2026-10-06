/**
 * Test harness: boots the REAL Express app + Socket.IO server against a real
 * MongoDB (TEST_MONGO_URI). Only the two external internet services (OSRM
 * routing, Nominatim geocoding) are replaced by a tiny local double, because
 * the tests must not depend on public servers being reachable.
 */
const http = require('http');

process.env.JWT_SECRET = 'test_secret_value_for_tests_only';
process.env.NODE_ENV = 'test';
process.env.GPS_MIN_UPDATE_INTERVAL_MS = '250';
process.env.CLIENT_URL = 'http://localhost:5173';

function encodePolyline(points) {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  const enc = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += enc(la - lastLat) + enc(ln - lastLng);
    lastLat = la;
    lastLng = ln;
  }
  return out;
}

/** Stand-in for the public OSRM + Nominatim servers. */
function startFakeGeoServer({ routeMeters = 10000, routeSeconds = 1200 } = {}) {
  const state = { osrmDown: false, routeRequests: 0, geocodeRequests: 0 };
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/route/v1/driving/')) {
      state.routeRequests += 1;
      state.lastRouteUrl = req.url;
      if (state.osrmDown) {
        res.statusCode = 503;
        return res.end('{}');
      }
      // Like OSRM: one leg per consecutive pair of waypoints; the total is split evenly between them.
      const waypointCount = decodeURIComponent(req.url.split('/driving/')[1].split('?')[0]).split(';').length;
      const legCount = Math.max(1, waypointCount - 1);
      const legs = Array.from({ length: legCount }, () => ({ distance: routeMeters / legCount, duration: routeSeconds / legCount }));
      return res.end(
        JSON.stringify({
          code: 'Ok',
          routes: [{ distance: routeMeters, duration: routeSeconds, legs, geometry: encodePolyline([[9.17, 77.87], [9.18, 77.88]]) }]
        })
      );
    }
    if (req.url.startsWith('/search')) {
      state.geocodeRequests += 1;
      return res.end(JSON.stringify([{ display_name: 'Geocoded Place, Tamil Nadu', lat: '9.1500', lon: '77.8500' }]));
    }
    res.statusCode = 404;
    return res.end('{}');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, state, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function bootApp(geoUrl, { db } = {}) {
  process.env.OSRM_BASE_URL = geoUrl;
  process.env.NOMINATIM_BASE_URL = geoUrl;
  const mongoose = require('mongoose');
  const { Server } = require('socket.io');
  const app = require('../src/app');
  const { initSockets } = require('../src/sockets');

  // Each test file gets its own database so files can run in parallel without wiping each other.
  const uri = new URL(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/carpool_connect_test');
  if (db) uri.pathname = `/${db}`;
  await mongoose.connect(uri.toString());
  await mongoose.connection.dropDatabase();

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  initSockets(io);
  app.set('io', io);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  return {
    base: `http://127.0.0.1:${port}`,
    io,
    async close() {
      io.close();
      await new Promise((r) => server.close(r));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  };
}

module.exports = { bootApp, startFakeGeoServer, encodePolyline };
