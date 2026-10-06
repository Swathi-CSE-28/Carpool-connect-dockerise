/**
 * Road-route fare quote.
 *
 *   km        = driving distance from the OSRM road network (NOT straight-line)
 *   perSeat   = max(FARE_MIN, round(FARE_BASE + FARE_RATE_PER_KM x km))
 *
 * The route runs origin -> pickup stops (in order) -> destination. OSRM returns the
 * distance of every leg in one call, so a passenger boarding at stop i is quoted for
 * only the road distance still left from that stop to the destination.
 *
 * Everything is computed on the server from coordinates; the client's own numbers are never trusted.
 */
const cfg = require('../config/tracking');
const routing = require('./routingService');
const { isValidLatLng } = require('../utils/geo');

const round2 = (n) => Math.round(n * 100) / 100;

function priceForKm(km) {
  const step = cfg.FARE_ROUND_TO > 0 ? cfg.FARE_ROUND_TO : 1;
  const raw = cfg.FARE_BASE + cfg.FARE_RATE_PER_KM * km;
  return Math.max(cfg.FARE_MIN, Math.round(raw / step) * step);
}

const hasCoords = (p) => p && isValidLatLng(Number(p.lat), Number(p.lng));
const pt = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) });

/**
 * Fills in missing coordinates from place labels (server-side geocoding).
 * Mutates the given place objects. Returns the labels that could not be located.
 */
async function resolvePlaces(places) {
  const failed = [];
  for (const place of places) {
    if (!place || hasCoords(place)) continue;
    const hit = place.label ? await routing.geocodeLabel(place.label) : null;
    if (hit) {
      place.lat = hit.lat;
      place.lng = hit.lng;
    } else {
      failed.push(place.label || '(unnamed place)');
    }
  }
  return failed;
}

/**
 * @param {{origin, destination, pickupPoints?: Array}} input  places with lat/lng
 * @returns {Promise<{ok:true, ...quote} | {ok:false, reason, message}>}
 */
async function quoteRoadFare({ origin, destination, pickupPoints = [] }) {
  if (!hasCoords(origin) || !hasCoords(destination)) {
    return { ok: false, reason: 'missing_coordinates', message: 'Origin and destination must be located on the map first.' };
  }

  // Keep the caller's index so results can be matched back to the pickup list.
  const stops = pickupPoints
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => hasCoords(p))
    .sort((a, b) => (a.p.order ?? a.index) - (b.p.order ?? b.index));

  const waypoints = [pt(origin), ...stops.map(({ p }) => pt(p)), pt(destination)];
  const route = await routing.getRoute(waypoints);
  if (!route.ok) return route;

  const distanceKm = round2(route.distanceMeters / 1000);

  // legs[i] runs waypoint i -> i+1. Stop k (0-based) is waypoint k+1, so what is left from it
  // to the destination is the sum of legs from k+1 onward.
  const legs = route.legs?.length === waypoints.length - 1 ? route.legs : null;
  const pickups = pickupPoints.map(() => null);
  stops.forEach(({ index }, k) => {
    let remainingKm;
    if (legs) {
      remainingKm = round2(legs.slice(k + 1).reduce((n, l) => n + l.distanceMeters, 0) / 1000);
    } else {
      remainingKm = null; // router gave no per-leg data: do not guess
    }
    pickups[index] = remainingKm === null
      ? null
      : { distanceToDestKm: remainingKm, fare: priceForKm(remainingKm) };
  });

  return {
    ok: true,
    distanceKm,
    durationMin: Math.round(route.durationSec / 60),
    geometry: route.geometry,
    distanceMeters: route.distanceMeters,
    durationSec: route.durationSec,
    pricePerSeat: priceForKm(distanceKm),
    pickups,
    pricing: {
      baseFare: cfg.FARE_BASE,
      ratePerKm: cfg.FARE_RATE_PER_KM,
      minFare: cfg.FARE_MIN,
      formula: `₹${cfg.FARE_BASE} + ₹${cfg.FARE_RATE_PER_KM} × road km (minimum ₹${cfg.FARE_MIN})`
    },
    source: route.source
  };
}

module.exports = { quoteRoadFare, resolvePlaces, priceForKm };
