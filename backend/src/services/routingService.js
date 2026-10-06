/**
 * Thin wrapper around OpenStreetMap-based services:
 *  - OSRM   -> road routing (distance, duration, geometry)
 *  - Nominatim -> geocoding (place name -> coordinates)
 *
 * Both are called from the SERVER so the browser never talks to them directly:
 * that lets us cache, honour their usage limits (Nominatim: max 1 request per
 * second, identifying User-Agent) and back off when rate limited. Neither needs
 * an API key. Point OSRM_BASE_URL / NOMINATIM_BASE_URL at your own instance for
 * production traffic - the public demo servers are not meant for heavy use.
 *
 * Every function fails soft: it returns { ok:false, reason } instead of throwing,
 * so callers can show an honest "unavailable" message instead of inventing data.
 */
const cfg = require('../config/tracking');
const { isValidLatLng } = require('../utils/geo');

const cache = new Map(); // key -> { value, expires }
const CACHE_MAX = 500;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // drop oldest
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// After a 429 / repeated failure, stop calling the service for a while.
const backoff = { osrm: 0, nominatim: 0 };
const failures = { osrm: 0, nominatim: 0 };

function noteFailure(service, status) {
  failures[service] += 1;
  if (status === 429 || failures[service] >= 3) {
    const waitMs = status === 429 ? 60000 : 15000;
    backoff[service] = Date.now() + waitMs;
    failures[service] = 0;
  }
}

async function fetchJson(service, url) {
  if (Date.now() < backoff[service]) {
    return { ok: false, reason: 'rate_limited', message: 'Routing service is busy, try again shortly.' };
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': cfg.GEO_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) {
      noteFailure(service, res.status);
      return { ok: false, reason: res.status === 429 ? 'rate_limited' : 'service_error', message: `Routing service returned ${res.status}` };
    }
    failures[service] = 0;
    return { ok: true, data: await res.json() };
  } catch (err) {
    noteFailure(service, 0);
    return { ok: false, reason: 'unreachable', message: 'Routing service is unreachable.' };
  }
}

/**
 * Road route through 2+ {lat,lng} points.
 * Returns { ok:true, distanceMeters, durationSec, geometry(polyline5), source:'osrm' }.
 */
async function getRoute(points, { cacheMs = 5 * 60 * 1000 } = {}) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 25) {
    return { ok: false, reason: 'invalid_input', message: 'Between 2 and 25 points are required.' };
  }
  if (!points.every((p) => p && isValidLatLng(p.lat, p.lng))) {
    return { ok: false, reason: 'invalid_input', message: 'Invalid coordinates.' };
  }

  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const key = `route:${coords}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = `${cfg.OSRM_BASE_URL}/route/v1/driving/${coords}?overview=simplified&geometries=polyline&steps=false`;
  const result = await fetchJson('osrm', url);
  if (!result.ok) return result;

  const route = result.data?.routes?.[0];
  if (result.data?.code !== 'Ok' || !route) {
    return { ok: false, reason: 'no_route', message: 'No drivable route was found between these points.' };
  }

  const value = {
    ok: true,
    distanceMeters: route.distance,
    durationSec: route.duration,
    geometry: route.geometry,
    legs: (route.legs || []).map((l) => ({ distanceMeters: l.distance, durationSec: l.duration })),
    source: 'osrm'
  };
  cacheSet(key, value, cacheMs);
  return value;
}

// Nominatim allows 1 request/second: serialise geocoding calls through a tiny queue.
let geocodeChain = Promise.resolve();
let lastGeocodeAt = 0;

function queueGeocode(task) {
  const run = geocodeChain.then(async () => {
    const wait = Math.max(0, lastGeocodeAt + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastGeocodeAt = Date.now();
    return task();
  });
  geocodeChain = run.catch(() => {});
  return run;
}

/** Place-name search. Returns { ok:true, results:[{label,lat,lng}] }. */
async function searchPlaces(query) {
  const q = String(query || '').trim();
  if (q.length < 3) return { ok: true, results: [] };
  const key = `geo:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '0' });
  if (cfg.NOMINATIM_COUNTRY_CODES) params.set('countrycodes', cfg.NOMINATIM_COUNTRY_CODES);
  const result = await queueGeocode(() => fetchJson('nominatim', `${cfg.NOMINATIM_BASE_URL}/search?${params}`));
  if (!result.ok) return result;

  const results = (Array.isArray(result.data) ? result.data : [])
    .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((r) => isValidLatLng(r.lat, r.lng));
  const value = { ok: true, results };
  cacheSet(key, value, 24 * 60 * 60 * 1000);
  return value;
}

/** Best single match for a label, or null. Used to fill in coordinates for rides created without them. */
async function geocodeLabel(label) {
  const res = await searchPlaces(label);
  return res.ok && res.results.length ? res.results[0] : null;
}

module.exports = { getRoute, searchPlaces, geocodeLabel };
