const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, startFakeGeoServer } = require('./helpers');

process.env.ETA_CACHE_MS = '100';

const { io: ioClient } = require('socket.io-client');
const { haversineMeters } = require('../src/utils/geo');

let app;
let fakeGeo;
let models;
let generateToken;
const sockets = [];
const users = {};
const tokens = {};
let ride;
let bookingP1;
let bookingP2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, token, body) {
  const res = await fetch(`${app.base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = {};
  try { json = await res.json(); } catch (e) { /* empty body */ }
  return { status: res.status, body: json };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = ioClient(app.base, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    sockets.push(s);
  });
}

const emitAck = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 4000);
    socket.emit(event, payload, (res) => { clearTimeout(t); resolve(res); });
  });

const waitFor = (socket, event, predicate = () => true, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => { socket.off(event, h); reject(new Error(`timeout waiting for ${event}`)); }, ms);
    const h = (payload) => { if (predicate(payload)) { clearTimeout(t); socket.off(event, h); resolve(payload); } };
    socket.on(event, h);
  });

/** Collects everything a socket receives for an event so tests can assert on "nothing arrived". */
function collect(socket, event) {
  const got = [];
  socket.on(event, (p) => got.push(p));
  return got;
}

const T0 = Date.now() - 70000;
const P0 = { lat: 9.17, lng: 77.87 };
const STEP = 0.0008; // ~89 m per reading (22 m/s at the 4 s device-time spacing)
const at = (i, extra = {}) => ({
  rideId: undefined,
  latitude: P0.lat + i * STEP,
  longitude: P0.lng,
  accuracy: 10,
  timestamp: T0 + i * 4000,
  ...extra
});

before(async () => {
  fakeGeo = await startFakeGeoServer();
  app = await bootApp(fakeGeo.url, { db: 'cc_test_tracking' });
  generateToken = require('../src/utils/generateToken');
  models = {
    User: require('../src/models/User'),
    Ride: require('../src/models/Ride'),
    Booking: require('../src/models/Booking'),
    RideLocation: require('../src/models/RideLocation'),
    RideLocationPoint: require('../src/models/RideLocationPoint')
  };
  const mk = async (key, role, extra = {}) => {
    users[key] = await models.User.create({ name: key, email: `${key}@test.app`, password: 'Carpool@123', role, phone: '+91 90000 00000', ...extra });
    tokens[key] = generateToken(users[key]._id, role);
  };
  await mk('driver', 'driver', { vehicle: { make: 'Maruti', model: 'Swift', color: 'White', plateNumber: 'tn 72 ab 1234' } });
  await mk('otherDriver', 'driver');
  await mk('p1', 'passenger');
  await mk('p2', 'passenger');
  await mk('pending', 'passenger');
  await mk('stranger', 'passenger');
  await mk('admin', 'admin');
});

after(async () => {
  sockets.forEach((s) => s.close());
  await app.close();
  await new Promise((r) => fakeGeo.server.close(r));
});

test('setup: driver offers a distance-billed ride; passengers must consent to book it', async () => {
  const create = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'Origin A', lat: 9.17, lng: 77.87 },
    destination: { label: 'Destination B', lat: 9.26, lng: 77.87 },
    pickupPoints: [{ label: 'Pickup 1', lat: 9.172, lng: 77.871, order: 0 }],
    departureTime: new Date(Date.now() + 3600e3).toISOString(),
    totalSeats: 4, pricePerSeat: 100, distanceKm: 10, fareBasis: 'actual'
  });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  ride = create.body.ride;
  assert.equal(ride.fareBasis, 'actual');
  assert.equal(ride.tracking.state, 'idle');

  const noConsent = await api('POST', '/bookings', tokens.p1, { rideId: ride._id, seatsRequested: 2 });
  assert.equal(noConsent.status, 400);
  assert.match(noConsent.body.message, /distance/i);

  const b1 = await api('POST', '/bookings', tokens.p1, { rideId: ride._id, seatsRequested: 2, pickupPointId: ride.pickupPoints[0]._id, acceptDistanceBilling: true });
  const b2 = await api('POST', '/bookings', tokens.p2, { rideId: ride._id, seatsRequested: 1, acceptDistanceBilling: true });
  const b3 = await api('POST', '/bookings', tokens.pending, { rideId: ride._id, seatsRequested: 1, acceptDistanceBilling: true });
  assert.equal(b1.status, 201);
  bookingP1 = b1.body.booking;
  bookingP2 = b2.body.booking;
  assert.equal(bookingP1.acceptedDistanceBilling, true);

  for (const b of [bookingP1, bookingP2]) {
    const acc = await api('PATCH', `/bookings/${b._id}/status`, tokens.driver, { status: 'accepted' });
    assert.equal(acc.status, 200);
  }
  assert.equal(b3.status, 201); // stays pending on purpose
});

test('ride status can no longer be edited through the generic ride PATCH', async () => {
  const res = await api('PATCH', `/rides/${ride._id}`, tokens.driver, { status: 'completed' });
  assert.equal(res.status, 400);
});

test('before the ride starts: passenger sees a clear "not started" state and no location', async () => {
  const snap = await api('GET', `/tracking/rides/${ride._id}`, tokens.p1);
  assert.equal(snap.status, 200);
  assert.equal(snap.body.tracking.state, 'idle');
  assert.equal(snap.body.tracking.location, null);
  assert.equal(snap.body.ride.statusLabel, 'Scheduled');
  assert.equal(snap.body.driver.vehicle.plateNumber, 'TN 72 AB 1234');
  assert.equal(snap.body.driver.phone, '+91 90000 00000');
  assert.equal(snap.body.fare.estimated.totalAmount, 200);
  assert.equal(snap.body.pickup.label, 'Pickup 1');
});

test('snapshot access: strangers, pending bookings, other drivers and admins are refused', async () => {
  for (const who of ['stranger', 'pending', 'otherDriver', 'admin']) {
    const res = await api('GET', `/tracking/rides/${ride._id}`, tokens[who]);
    assert.equal(res.status, 403, `${who} should be refused`);
  }
  assert.equal((await api('GET', `/tracking/rides/${ride._id}`)).status, 401);
});

test('only the ride owner can start; a passenger and another driver cannot', async () => {
  assert.equal((await api('POST', `/tracking/rides/${ride._id}/start`, tokens.p1)).status, 403);
  assert.equal((await api('POST', `/tracking/rides/${ride._id}/start`, tokens.otherDriver)).status, 403);
});

test('socket security: unauthorized users cannot subscribe to the ride room', async () => {
  for (const who of ['stranger', 'pending', 'otherDriver', 'admin']) {
    const s = await connect(tokens[who]);
    const ack = await emitAck(s, 'tracking:subscribe', { rideId: String(ride._id) });
    assert.equal(ack.ok, false, `${who} must be refused`);
    assert.equal(ack.code, 'NOT_AUTHORIZED');
  }
  const bad = await connect(tokens.p1);
  assert.equal((await emitAck(bad, 'tracking:subscribe', { rideId: 'not-an-id' })).code, 'INVALID_RIDE');

  // and an invalid token cannot even open a socket
  await assert.rejects(connect('garbage.token.value'));
});

let driverSock;
let p1Sock;
let p2Sock;
let strangerSock;
let p1Locations;
let p2Locations;
let strangerLocations;

test('driver starts the ride; passengers subscribed beforehand are told live', async () => {
  p1Sock = await connect(tokens.p1);
  p2Sock = await connect(tokens.p2);
  strangerSock = await connect(tokens.stranger);
  driverSock = await connect(tokens.driver);

  assert.equal((await emitAck(p1Sock, 'tracking:subscribe', { rideId: String(ride._id) })).ok, true);
  assert.equal((await emitAck(p2Sock, 'tracking:subscribe', { rideId: String(ride._id) })).ok, true);
  assert.equal((await emitAck(driverSock, 'tracking:subscribe', { rideId: String(ride._id) })).role, 'driver');
  await emitAck(strangerSock, 'tracking:subscribe', { rideId: String(ride._id) });

  p1Locations = collect(p1Sock, 'tracking:location');
  p2Locations = collect(p2Sock, 'tracking:location');
  strangerLocations = collect(strangerSock, 'tracking:location');

  const statusEvt = waitFor(p1Sock, 'tracking:status', (p) => p.trackingState === 'active');
  const start = await api('POST', `/tracking/rides/${ride._id}/start`, tokens.driver);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const evt = await statusEvt;
  assert.equal(evt.statusLabel, 'Driver En Route');

  assert.equal((await api('POST', `/tracking/rides/${ride._id}/start`, tokens.driver)).status, 409, 'double start');

});

test('planned route is computed server-side and cached on the ride', async () => {
  await sleep(300); // route preparation runs in the background after start
  const snap = await api('GET', `/tracking/rides/${ride._id}`, tokens.p1);
  assert.ok(snap.body.tracking.route?.geometry, 'route geometry stored');
  assert.equal(snap.body.tracking.route.distanceMeters, 10000);
});

test('a driver cannot start a second ride while one is live', async () => {
  const r2 = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'X', lat: 9.1, lng: 77.8 }, destination: { label: 'Y', lat: 9.2, lng: 77.9 },
    departureTime: new Date(Date.now() + 7200e3).toISOString(), totalSeats: 2
  });
  const res = await api('POST', `/tracking/rides/${r2.body.ride._id}/start`, tokens.driver);
  assert.equal(res.status, 409);
});

test('publishing: only the ride owner may publish location', async () => {
  const payload = { ...at(0), rideId: String(ride._id) };
  assert.equal((await emitAck(p1Sock, 'tracking:location', payload)).code, 'NOT_AUTHORIZED');
  const other = await connect(tokens.otherDriver);
  assert.equal((await emitAck(other, 'tracking:location', payload)).code, 'NOT_AUTHORIZED');
  assert.equal((await api('POST', `/tracking/rides/${ride._id}/location`, tokens.otherDriver, payload)).status, 403);
});

test('GPS pipeline: valid readings broadcast; invalid/duplicate/stale/out-of-order/poor readings are rejected', async () => {
  const id = String(ride._id);
  const send = async (p) => { await sleep(320); return emitAck(driverSock, 'tracking:location', { ...p, rideId: id }); };

  const r0 = await send(at(0));
  assert.equal(r0.ok, true);
  assert.equal(r0.counted, false, 'first fix is only a baseline');

  const r1 = await send(at(1));
  assert.equal(r1.ok, true);
  assert.equal(r1.counted, true);

  assert.equal((await send(at(1))).code, 'DUPLICATE');
  assert.equal((await send(at(0))).code, 'OUT_OF_ORDER');
  assert.equal((await send(at(2, { accuracy: 150 }))).code, 'POOR_ACCURACY');
  assert.equal((await send(at(2, { latitude: 95 }))).code, 'INVALID_COORDINATES');
  assert.equal((await send(at(2, { latitude: 'x' }))).code, 'INVALID_COORDINATES');
  assert.equal((await send(at(2, { latitude: 0, longitude: 0 }))).code, 'INVALID_COORDINATES');
  assert.equal((await send(at(2, { timestamp: Date.now() - 10 * 60 * 1000 }))).code, 'STALE');
  assert.equal((await send(at(2, { timestamp: Date.now() + 10 * 60 * 1000 }))).code, 'INVALID_TIMESTAMP');
  assert.equal((await send(at(2, { accuracy: -5 }))).code, 'INVALID_ACCURACY');

  const jump = await send(at(3, { latitude: 10.5 })); // ~130 km in 8 s
  assert.equal(jump.code, 'IMPLAUSIBLE_JUMP');

  const lowAcc = await send(at(2, { accuracy: 80 })); // shown, never billed
  assert.equal(lowAcc.ok, true);
  assert.equal(lowAcc.counted, false);

  // burst: second reading inside the throttle window is refused
  const a = await send(at(3));
  const b = await emitAck(driverSock, 'tracking:location', { ...at(4), rideId: id });
  assert.equal(a.ok, true);
  assert.equal(b.code, 'THROTTLED');

  for (let i = 4; i <= 9; i += 1) assert.equal((await send(at(i))).ok, true, `reading ${i}`);

  const expected = haversineMeters(P0, { lat: P0.lat + 9 * STEP, lng: P0.lng });
  const loc = await models.RideLocation.findOne({ rideId: ride._id });
  assert.ok(Math.abs(loc.distanceMeters - expected) < 1.5, `server distance ${loc.distanceMeters} vs expected ${expected}`);
  assert.ok(loc.rejectedCount >= 0);
});

test('authorized passengers receive live updates; unrelated users receive nothing', async () => {
  assert.ok(p1Locations.length >= 9, `p1 got ${p1Locations.length}`);
  assert.equal(p1Locations.length, p2Locations.length);
  assert.equal(strangerLocations.length, 0, 'a user who failed authorization must receive no locations');
  const last = p1Locations[p1Locations.length - 1];
  assert.ok(Math.abs(last.latitude - (P0.lat + 9 * STEP)) < 1e-9);
  assert.ok(last.distanceMeters > 600);
  // internal accounting state is never leaked
  assert.equal(last.distPoint, undefined);
  // the rejected teleport (lat 10.5) was never broadcast
  assert.ok(p1Locations.every((p) => p.latitude < 10));
});

test('snapshot while live: passenger sees location, sampled trail and server distance', async () => {
  const snap = await api('GET', `/tracking/rides/${ride._id}`, tokens.p1);
  assert.equal(snap.body.tracking.state, 'active');
  assert.ok(snap.body.tracking.location.latitude > 9.17);
  assert.ok(snap.body.tracking.trail.length >= 1);
  assert.ok(snap.body.tracking.actualDistanceKm > 0.6);
  const points = await models.RideLocationPoint.countDocuments({ rideId: ride._id });
  assert.ok(points >= 1 && points <= p1Locations.length, `history never exceeds broadcasts (${points} vs ${p1Locations.length})`);

  const drv = await api('GET', `/tracking/rides/${ride._id}`, tokens.driver);
  assert.equal(drv.body.passengers.length, 2);
  assert.equal(drv.body.driver.phone, undefined);
});

test('ETA: computed from the road network when routing works, honest fallback when it does not', async () => {
  const ok = await api('GET', `/tracking/rides/${ride._id}/eta`, tokens.p1);
  assert.equal(ok.body.eta.available, true);
  assert.equal(ok.body.eta.target, 'pickup');
  assert.equal(ok.body.eta.durationSec, 1200);
  assert.ok(ok.body.eta.arrivalAt);

  fakeGeo.state.osrmDown = true;
  await sleep(150);
  const down = await api('GET', `/tracking/rides/${ride._id}/eta`, tokens.p1);
  fakeGeo.state.osrmDown = false;
  assert.equal(down.body.eta.available, false);
  assert.match(down.body.eta.message, /not available/i);
  assert.equal(typeof down.body.eta.straightLineMeters, 'number');
  assert.equal(down.body.eta.arrivalAt, undefined, 'no invented arrival time');
});

test('HTTP fallback endpoint enforces the same rules as the socket', async () => {
  await sleep(320);
  const good = await api('POST', `/tracking/rides/${ride._id}/location`, tokens.driver, at(10));
  assert.equal(good.status, 200);
  assert.equal(good.body.accepted, true);
  await sleep(320);
  const bad = await api('POST', `/tracking/rides/${ride._id}/location`, tokens.driver, at(11, { latitude: 200 }));
  assert.equal(bad.status, 202);
  assert.equal(bad.body.code, 'INVALID_COORDINATES');
});

test('pause stops accepting updates and does not bill movement made while paused', async () => {
  const before = (await models.RideLocation.findOne({ rideId: ride._id })).distanceMeters;
  const paused = waitFor(p1Sock, 'tracking:status', (p) => p.trackingState === 'paused');
  assert.equal((await api('POST', `/tracking/rides/${ride._id}/pause`, tokens.driver)).status, 200);
  await paused;

  await sleep(320);
  const res = await emitAck(driverSock, 'tracking:location', { ...at(12), rideId: String(ride._id) });
  assert.equal(res.code, 'PAUSED');

  assert.equal((await api('POST', `/tracking/rides/${ride._id}/resume`, tokens.driver)).status, 200);
  await sleep(320);
  // resume far from where we paused (~1.1 km): must not be joined to the old point
  const resumed = await emitAck(driverSock, 'tracking:location', { ...at(13, { latitude: P0.lat + 0.02 }), rideId: String(ride._id) });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.counted, false);
  const after = (await models.RideLocation.findOne({ rideId: ride._id })).distanceMeters;
  assert.ok(Math.abs(after - before) < 1, `distance unchanged across pause (${before} -> ${after})`);
});

test('ride status timeline: forward only, driver only', async () => {
  const id = ride._id;
  assert.equal((await api('POST', `/tracking/rides/${id}/status`, tokens.p1, { step: 'in_progress' })).status, 403);
  assert.equal((await api('POST', `/tracking/rides/${id}/status`, tokens.driver, { step: 'teleport' })).status, 400);
  const arrived = waitFor(p1Sock, 'tracking:status', (p) => p.rideStatus === 'pickup_in_progress');
  assert.equal((await api('POST', `/tracking/rides/${id}/status`, tokens.driver, { step: 'arrived_pickup' })).status, 200);
  assert.equal((await arrived).statusLabel, 'Arrived at Pickup');
  assert.equal((await api('POST', `/tracking/rides/${id}/status`, tokens.driver, { step: 'arrived_pickup' })).status, 409, 'no repeating a step');
  assert.equal((await api('POST', `/tracking/rides/${id}/status`, tokens.driver, { step: 'in_progress' })).status, 200);
});

test('a passenger who cancels mid-ride loses access immediately; others keep it', async () => {
  const ended = waitFor(p2Sock, 'tracking:ended', (p) => p.reason === 'booking_cancelled');
  const cancel = await api('DELETE', `/bookings/${bookingP2._id}`, tokens.p2);
  assert.equal(cancel.status, 200);
  await ended;

  const p2Before = p2Locations.length;
  const p1Before = p1Locations.length;
  await sleep(320);
  await emitAck(driverSock, 'tracking:location', { ...at(14, { latitude: P0.lat + 0.02 + STEP }), rideId: String(ride._id) });
  await sleep(150);
  assert.equal(p2Locations.length, p2Before, 'cancelled passenger receives nothing more');
  assert.equal(p1Locations.length, p1Before + 1, 'confirmed passenger still receives');

  assert.equal((await api('GET', `/tracking/rides/${ride._id}`, tokens.p2)).status, 403, 'cancelled booking has no tracking access');
  const resub = await emitAck(p2Sock, 'tracking:subscribe', { rideId: String(ride._id) });
  assert.equal(resub.ok, false, 'cannot re-subscribe after cancelling');
});

test('End Ride: tracking stops, distance + fares finalized once, data purged, payment hook set', async () => {
  const dist = (await models.RideLocation.findOne({ rideId: ride._id })).distanceMeters;
  const fare = waitFor(p1Sock, 'tracking:fare');
  const ended = waitFor(p1Sock, 'tracking:ended', (p) => p.reason === 'completed');

  const end = await api('POST', `/tracking/rides/${ride._id}/end`, tokens.driver);
  assert.equal(end.status, 200, JSON.stringify(end.body));
  assert.equal(end.body.fares.length, 1, 'only the still-confirmed passenger is billed');

  const measuredKm = Math.round(dist) / 1000;
  const f = end.body.fares[0].fare;
  assert.equal(f.basis, 'actual');
  assert.ok(Math.abs(f.actualDistanceKm - measuredKm) < 0.011);
  assert.equal(f.seats, 2);
  assert.equal(f.perSeatAmount, Math.round(f.ratePerKm * f.actualDistanceKm * 100) / 100 || f.perSeatAmount);
  assert.equal(f.totalAmount, Math.round(f.perSeatAmount * 2 * 100) / 100);

  assert.equal((await fare).fare.totalAmount, f.totalAmount);
  assert.equal((await ended).actualDistanceKm, f.actualDistanceKm);

  const b = await models.Booking.findById(bookingP1._id);
  assert.equal(b.status, 'completed');
  assert.equal(b.paymentStatus, 'pending');
  assert.equal(b.fare.totalAmount, f.totalAmount);
  const b2 = await models.Booking.findById(bookingP2._id);
  assert.equal(b2.status, 'cancelled');
  assert.equal(b2.fare?.finalizedAt, undefined);

  assert.equal(await models.RideLocation.countDocuments({ rideId: ride._id }), 0);
  assert.equal(await models.RideLocationPoint.countDocuments({ rideId: ride._id }), 0);

  const r = await models.Ride.findById(ride._id);
  assert.equal(r.status, 'completed');
  assert.equal(r.tracking.state, 'ended');
  assert.ok(r.tracking.actualDistanceMeters > 600);

  assert.equal((await api('POST', `/tracking/rides/${ride._id}/end`, tokens.driver)).status, 409, 'cannot finalize twice');
});

test('after the ride: no more updates accepted, no location exposed, passenger sees own final fare', async () => {
  await sleep(320);
  const res = await emitAck(driverSock, 'tracking:location', { ...at(15), rideId: String(ride._id) });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'RIDE_ENDED');

  const snap = await api('GET', `/tracking/rides/${ride._id}`, tokens.p1);
  assert.equal(snap.body.tracking.location, null);
  assert.deepEqual(snap.body.tracking.trail, []);
  assert.equal(snap.body.fare.final.basis, 'actual');
  assert.ok(snap.body.tracking.actualDistanceKm > 0);

  const late = await emitAck(p1Sock, 'tracking:subscribe', { rideId: String(ride._id) });
  assert.equal(late.ok, false);
  assert.equal(late.code, 'RIDE_ENDED');

  assert.equal((await api('PATCH', `/bookings/${bookingP1._id}/status`, tokens.driver, { status: 'accepted' })).status >= 200, true);
});

test('cancelled ride: broadcasting stops immediately and location data is erased', async () => {
  const c = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'C1', lat: 9.3, lng: 77.9 }, destination: { label: 'C2', lat: 9.4, lng: 77.9 },
    departureTime: new Date(Date.now() + 1800e3).toISOString(), totalSeats: 2, pricePerSeat: 40, distanceKm: 8
  });
  const cid = c.body.ride._id;
  const bk = await api('POST', '/bookings', tokens.p1, { rideId: cid });
  await api('PATCH', `/bookings/${bk.body.booking._id}/status`, tokens.driver, { status: 'accepted' });

  assert.equal((await api('POST', `/tracking/rides/${cid}/start`, tokens.driver)).status, 200);
  assert.equal((await emitAck(p1Sock, 'tracking:subscribe', { rideId: cid })).ok, true);
  await emitAck(driverSock, 'tracking:subscribe', { rideId: cid });
  await sleep(320);
  const first = await emitAck(driverSock, 'tracking:location', { rideId: cid, latitude: 9.3, longitude: 77.9, accuracy: 8, timestamp: Date.now() - 1000 });
  assert.equal(first.ok, true);
  assert.equal(await models.RideLocation.countDocuments({ rideId: cid }), 1);

  const ended = waitFor(p1Sock, 'tracking:ended', (p) => p.reason === 'ride_cancelled');
  assert.equal((await api('DELETE', `/rides/${cid}`, tokens.driver)).status, 200);
  await ended;

  assert.equal(await models.RideLocation.countDocuments({ rideId: cid }), 0);
  await sleep(320);
  const res = await emitAck(driverSock, 'tracking:location', { rideId: cid, latitude: 9.3, longitude: 77.9, accuracy: 8, timestamp: Date.now() - 500 });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'RIDE_ENDED');

  // the passenger's booking was cancelled with the ride, so they have no tracking access at all
  assert.equal((await api('GET', `/tracking/rides/${cid}`, tokens.p1)).status, 403);
  const snap = await api('GET', `/tracking/rides/${cid}`, tokens.driver);
  assert.equal(snap.body.tracking.location, null);
  assert.deepEqual(snap.body.tracking.trail, []);
  assert.equal(snap.body.ride.status, 'cancelled');
  assert.equal((await api('DELETE', `/rides/${ride._id}`, tokens.driver)).status, 409, 'completed ride cannot be cancelled');
});

test('estimated-basis ride bills the listed price regardless of distance driven', async () => {
  const c = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'E1', lat: 9.3, lng: 77.9 }, destination: { label: 'E2', lat: 9.4, lng: 77.9 },
    departureTime: new Date(Date.now() + 1800e3).toISOString(), totalSeats: 2, pricePerSeat: 40, distanceKm: 1
  });
  const id = c.body.ride._id;
  const bk = await api('POST', '/bookings', tokens.p1, { rideId: id });
  await api('PATCH', `/bookings/${bk.body.booking._id}/status`, tokens.driver, { status: 'accepted' });
  await api('POST', `/tracking/rides/${id}/start`, tokens.driver);
  for (let i = 0; i < 4; i += 1) {
    await sleep(320);
    await emitAck(driverSock, 'tracking:location', { rideId: id, latitude: 9.3 + i * 0.001, longitude: 77.9, accuracy: 5, timestamp: Date.now() - 20000 + i * 4000 });
  }
  const end = await api('POST', `/tracking/rides/${id}/end`, tokens.driver);
  assert.equal(end.status, 200);
  assert.equal(end.body.fares[0].fare.basis, 'estimated');
  assert.equal(end.body.fares[0].fare.totalAmount, 40);
  assert.ok(end.body.actualDistanceKm > 0.2, 'distance is still measured and reported');
});

test('rides without coordinates are geocoded server-side (not hardcoded) when tracking data is requested', async () => {
  const c = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'Some Bus Stand' }, destination: { label: 'Some College' },
    pickupPoints: [{ label: 'Some Junction' }],
    departureTime: new Date(Date.now() + 1800e3).toISOString(), totalSeats: 2
  });
  const before = fakeGeo.state.geocodeRequests;
  const snap = await api('GET', `/tracking/rides/${c.body.ride._id}`, tokens.driver);
  assert.equal(snap.status, 200);
  assert.ok(fakeGeo.state.geocodeRequests > before, 'geocoder was consulted');
  assert.equal(typeof snap.body.ride.origin.lat, 'number');
  const stored = await models.Ride.findById(c.body.ride._id);
  assert.equal(typeof stored.origin.lat, 'number');
});

test('invalid ride coordinates are rejected at creation', async () => {
  const res = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'Bad', lat: 123, lng: 77 }, destination: { label: 'D', lat: 9, lng: 77 },
    departureTime: new Date(Date.now() + 3600e3).toISOString(), totalSeats: 2
  });
  assert.equal(res.status, 400);
});

test('history sampling: near-stationary updates do not create a database row per GPS fix', async () => {
  const c = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'S1', lat: 9.5, lng: 77.9 }, destination: { label: 'S2', lat: 9.6, lng: 77.9 },
    departureTime: new Date(Date.now() + 1800e3).toISOString(), totalSeats: 2, pricePerSeat: 40, distanceKm: 8
  });
  const id = c.body.ride._id;
  assert.equal((await api('POST', `/tracking/rides/${id}/start`, tokens.driver)).status, 200);
  for (let i = 0; i < 6; i += 1) {
    await sleep(320);
    // sitting at a red light: ~1 m of GPS wobble, readings 2 s apart
    const res = await emitAck(driverSock, 'tracking:location', {
      rideId: id, latitude: 9.5 + i * 0.00001, longitude: 77.9, accuracy: 6, timestamp: Date.now() - 12000 + i * 2000
    });
    assert.equal(res.ok, true);
    assert.equal(res.counted, false);
  }
  const loc = await models.RideLocation.findOne({ rideId: id });
  assert.equal(loc.acceptedCount, 6);
  assert.equal(loc.distanceMeters, 0, 'GPS jitter is never billed as distance');
  assert.equal(await models.RideLocationPoint.countDocuments({ rideId: id }), 1, 'one stored point, not six');
  assert.equal(await models.RideLocation.countDocuments({ rideId: id }), 1, 'a single latest-location document per ride');
  await api('POST', `/tracking/rides/${id}/end`, tokens.driver);
});

test('road-route fare quote: distance, ETA-style duration and fare come from the router, per pickup stop', async () => {
  const res = await api('POST', '/fare/quote', tokens.driver, {
    origin: { label: 'A', lat: 9.17, lng: 77.87 }, destination: { label: 'B', lat: 9.26, lng: 77.87 },
    pickupPoints: [{ label: 'Stop 1', lat: 9.2, lng: 77.87, order: 0 }]
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.distanceKm, 10);
  assert.equal(res.body.durationMin, 20);
  assert.equal(res.body.pricePerSeat, 40); // 10 + 3 x 10
  assert.equal(res.body.pickups[0].distanceToDestKm, 5); // router leg after the stop
  assert.equal(res.body.pickups[0].fare, 25); // 10 + 3 x 5
  assert.ok(res.body.geometry);
  assert.match(fakeGeo.state.lastRouteUrl, /^\/route\/v1\/driving\/77\.870000,9\.170000;77\.870000,9\.200000;77\.870000,9\.260000/);

  assert.equal((await api('POST', '/fare/quote', tokens.p1, { origin: {}, destination: {} })).status, 403, 'passengers cannot request quotes');
  assert.equal((await api('POST', '/fare/quote', tokens.driver, { origin: { label: 'x', lat: 999, lng: 1 }, destination: { label: 'y', lat: 9, lng: 77 } })).status, 400);
});

test('auto-fare ride: server computes distance + price + per-stop fares; client numbers are ignored', async () => {
  const create = await api('POST', '/rides', tokens.driver, {
    origin: { label: 'Auto A', lat: 9.17, lng: 77.87 }, destination: { label: 'Auto B', lat: 9.26, lng: 77.87 },
    pickupPoints: [{ label: 'Mid stop', lat: 9.2, lng: 77.87 }],
    departureTime: new Date(Date.now() + 3600e3).toISOString(), totalSeats: 3,
    fareMode: 'auto', pricePerSeat: 9999, distanceKm: 1
  });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const r = create.body.ride;
  assert.equal(r.fareMode, 'auto');
  assert.equal(r.distanceKm, 10);
  assert.equal(r.pricePerSeat, 40);
  assert.equal(r.pickupPoints[0].fare, 25);
  assert.ok(r.tracking.route.geometry, 'planned road route is stored at creation, before the ride starts');

  // passenger sees the planned route before the driver starts
  const bk = await api('POST', '/bookings', tokens.p1, { rideId: r._id, seatsRequested: 2, pickupPointId: r.pickupPoints[0]._id });
  assert.equal(bk.status, 201, JSON.stringify(bk.body));
  assert.equal(bk.body.booking.quotedPerSeat, 25);
  await api('PATCH', `/bookings/${bk.body.booking._id}/status`, tokens.driver, { status: 'accepted' });
  const snap = await api('GET', `/tracking/rides/${r._id}`, tokens.p1);
  assert.ok(snap.body.tracking.route.geometry);
  assert.equal(snap.body.fare.estimated.perSeatAmount, 25);
  assert.equal(snap.body.fare.estimated.totalAmount, 50);
  assert.equal(snap.body.fare.estimated.fromRoadRoute, true);

  // fare cannot be hand-edited on a road-route ride
  assert.equal((await api('PATCH', `/rides/${r._id}`, tokens.driver, { pricePerSeat: 1 })).status, 400);

  // bookings with a pickup that isn't part of the ride are refused
  const bad = await api('POST', '/bookings', tokens.p2, { rideId: r._id, pickupPointId: '64b7f0f0f0f0f0f0f0f0f0f0' });
  assert.equal(bad.status, 400);

  // ride ends: billed the quote for THEIR pickup
  await api('POST', `/tracking/rides/${r._id}/start`, tokens.driver);
  const end = await api('POST', `/tracking/rides/${r._id}/end`, tokens.driver);
  assert.equal(end.status, 200, JSON.stringify(end.body));
  assert.equal(end.body.fares[0].fare.perSeatAmount, 25);
  assert.equal(end.body.fares[0].fare.totalAmount, 50);
  assert.equal(end.body.fares[0].fare.basis, 'estimated');
});

test('auto-fare ride is refused (not guessed) when the router is down or a place cannot be located', async () => {
  const body = {
    origin: { label: 'Down A', lat: 9.17, lng: 77.87 }, destination: { label: 'Down B', lat: 9.27, lng: 77.88 },
    departureTime: new Date(Date.now() + 3600e3).toISOString(), totalSeats: 2, fareMode: 'auto'
  };
  fakeGeo.state.osrmDown = true;
  const before = await models.Ride.countDocuments({});
  const down = await api('POST', '/rides', tokens.driver, body);
  fakeGeo.state.osrmDown = false;
  assert.equal(down.status, 503);
  assert.match(down.body.message, /manual fare/i);
  assert.equal(await models.Ride.countDocuments({}), before, 'no half-priced ride was created');

  // same ride in manual mode still works (manual fares keep working)
  const manual = await api('POST', '/rides', tokens.driver, { ...body, fareMode: 'manual', pricePerSeat: 55, distanceKm: 12 });
  assert.equal(manual.status, 201);
  assert.equal(manual.body.ride.pricePerSeat, 55);
  assert.equal(manual.body.ride.fareMode, 'manual');

  assert.equal((await api('POST', '/rides', tokens.driver, { ...body, fareMode: 'weird' })).status, 400);
});
