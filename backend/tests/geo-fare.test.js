const test = require('node:test');
const assert = require('node:assert/strict');
const { haversineMeters, isValidLatLng, isNullIsland } = require('../src/utils/geo');
const { finalizeFare, estimateFare } = require('../src/services/fareService');

test('haversine: ~111.2 km per degree of latitude, 0 for identical points', () => {
  const d = haversineMeters({ lat: 9, lng: 77 }, { lat: 10, lng: 77 });
  assert.ok(Math.abs(d - 111195) < 200, `got ${d}`);
  assert.equal(haversineMeters({ lat: 9, lng: 77 }, { lat: 9, lng: 77 }), 0);
});

test('coordinate validation rejects out-of-range, non-numeric and null-island', () => {
  assert.equal(isValidLatLng(9.1, 77.8), true);
  assert.equal(isValidLatLng(91, 77), false);
  assert.equal(isValidLatLng(9, 181), false);
  assert.equal(isValidLatLng('9', 77), false);
  assert.equal(isValidLatLng(NaN, 77), false);
  assert.equal(isNullIsland(0, 0), true);
});

const ride = (over = {}) => ({ pricePerSeat: 100, distanceKm: 10, fareBasis: 'actual', ...over });
const booking = (over = {}) => ({ seatsRequested: 1, acceptedDistanceBilling: true, ...over });

test('estimated policy: listed price, deviation never charged', () => {
  const f = finalizeFare({ ride: ride({ fareBasis: 'estimated' }), booking: booking(), actualMeters: 14000 });
  assert.equal(f.basis, 'estimated');
  assert.equal(f.totalAmount, 100);
});

test('actual policy + consent: fare scales with distance travelled', () => {
  const f = finalizeFare({ ride: ride(), booking: booking(), actualMeters: 11000 });
  assert.equal(f.basis, 'actual');
  assert.equal(f.ratePerKm, 10);
  assert.equal(f.perSeatAmount, 110);
});

test('actual policy without passenger consent falls back to listed price', () => {
  const f = finalizeFare({ ride: ride(), booking: booking({ acceptedDistanceBilling: false }), actualMeters: 11000 });
  assert.equal(f.basis, 'estimated');
  assert.match(f.basisReason, /did not agree/);
});

test('actual fare is capped at 125% of the planned distance', () => {
  const f = finalizeFare({ ride: ride(), booking: booking(), actualMeters: 20000 });
  assert.equal(f.basis, 'actual');
  assert.equal(f.capped, true);
  assert.equal(f.perSeatAmount, 125);
});

test('too little GPS data falls back to listed price', () => {
  const f = finalizeFare({ ride: ride(), booking: booking(), actualMeters: 100 });
  assert.equal(f.basis, 'estimated');
});

test('shared ride: per-seat fare x that passenger\'s seats', () => {
  const f = finalizeFare({ ride: ride(), booking: booking({ seatsRequested: 2 }), actualMeters: 10000 });
  assert.equal(f.totalAmount, 200);
  assert.equal(estimateFare(ride(), 2).totalAmount, 200);
});

const { priceForKm } = require('../src/services/fareQuoteService');

test('road fare formula: base + rate x km, with a minimum', () => {
  assert.equal(priceForKm(10), 40); // 10 + 3 x 10
  assert.equal(priceForKm(0.5), 20); // below the minimum fare
  assert.equal(priceForKm(12.34), 47); // 10 + 37.02 -> rounded to the nearest rupee
});

test('per-pickup quote is what the passenger pays; distance billing scales THAT quote', () => {
  const stop = { _id: 'stop1', distanceToDestKm: 5, fare: 25 };
  const r = { pricePerSeat: 40, distanceKm: 10, fareBasis: 'actual', fareMode: 'auto', pickupPoints: { id: (id) => (id === 'stop1' ? stop : null) } };
  const b = { seatsRequested: 2, acceptedDistanceBilling: true, pickupPointId: 'stop1', quotedPerSeat: 25 };

  const est = estimateFare(r, 2, b);
  assert.equal(est.perSeatAmount, 25);
  assert.equal(est.totalAmount, 50);
  assert.equal(est.plannedDistanceKm, 5, 'planned km is the passenger\'s remaining road distance');

  // driver ended up driving 10% further than planned: 25 x 1.1 = 27.5 per seat
  const f = finalizeFare({ ride: r, booking: b, actualMeters: 11000 });
  assert.equal(f.basis, 'actual');
  assert.equal(f.perSeatAmount, 27.5);
  assert.equal(f.totalAmount, 55);
  assert.equal(f.ratePerKm, 5); // 25 / 5 km

  // quote is a snapshot: editing the ride's listed price afterwards doesn't change it
  const f2 = finalizeFare({ ride: { ...r, fareBasis: 'estimated', pricePerSeat: 999 }, booking: b, actualMeters: 11000 });
  assert.equal(f2.perSeatAmount, 25);
});
