/**
 * Central configuration for live GPS tracking. Every value can be overridden
 * from the environment (see .env.example) so nothing here is a magic number
 * buried in service code.
 */
const num = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const DEFAULT_EMERGENCY_CONTACTS = [
  { label: 'National Emergency Number (India)', number: '112' },
  { label: 'Police', number: '100' },
  { label: 'Ambulance', number: '108' },
  { label: 'Women Helpline', number: '1091' }
];

function loadEmergencyContacts() {
  if (!process.env.EMERGENCY_CONTACTS) return DEFAULT_EMERGENCY_CONTACTS;
  try {
    const parsed = JSON.parse(process.env.EMERGENCY_CONTACTS);
    const valid = Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.label === 'string' && typeof c.number === 'string')
      : [];
    return valid.length ? valid : DEFAULT_EMERGENCY_CONTACTS;
  } catch (err) {
    console.warn('[tracking] EMERGENCY_CONTACTS is not valid JSON, using defaults');
    return DEFAULT_EMERGENCY_CONTACTS;
  }
}

module.exports = {
  // --- GPS quality filters (server-side, authoritative) ---
  MAX_ACCEPT_ACCURACY_M: num('GPS_MAX_ACCEPT_ACCURACY_M', 100), // worse than this: rejected outright
  DISTANCE_MAX_ACCURACY_M: num('GPS_DISTANCE_MAX_ACCURACY_M', 50), // worse than this: shown, not billed
  MIN_SEGMENT_M: num('GPS_MIN_SEGMENT_M', 10), // ignore movement below GPS noise floor
  MAX_SPEED_MPS: num('GPS_MAX_SPEED_MPS', 55), // ~200 km/h, faster = implausible jump
  MAX_CONSECUTIVE_JUMPS: num('GPS_MAX_CONSECUTIVE_JUMPS', 3), // then re-baseline (no distance added)
  MAX_STALE_MS: num('GPS_MAX_STALE_MS', 120000), // reject readings older than this
  MAX_FUTURE_MS: num('GPS_MAX_FUTURE_MS', 30000), // tolerate small client clock skew

  // --- Throttling ---
  MIN_UPDATE_INTERVAL_MS: num('GPS_MIN_UPDATE_INTERVAL_MS', 1500), // per ride, server side

  // --- Retention ---
  HISTORY_TTL_HOURS: num('LOCATION_HISTORY_TTL_HOURS', 24), // backstop only; purged at ride end
  HISTORY_MIN_MOVE_M: num('LOCATION_HISTORY_MIN_MOVE_M', 50),
  HISTORY_MIN_INTERVAL_MS: num('LOCATION_HISTORY_MIN_INTERVAL_MS', 60000),
  TRAIL_MAX_POINTS: 300,

  // --- Ride rules ---
  START_WINDOW_MINUTES: num('TRACKING_START_WINDOW_MINUTES', 1440), // may start up to N min before departure
  ABANDON_MINUTES: num('TRACKING_ABANDON_MINUTES', 360), // no update for this long -> auto-pause
  SWEEP_INTERVAL_MS: num('TRACKING_SWEEP_INTERVAL_MS', 10 * 60 * 1000),

  // --- Fare policy ---
  FARE_MAX_ACTUAL_FACTOR: num('FARE_MAX_ACTUAL_FACTOR', 1.25), // actual-distance billing capped at 125% of plan
  FARE_MIN_ACTUAL_METERS: num('FARE_MIN_ACTUAL_METERS', 500), // below this we don't trust GPS distance

  // --- Road-route fare quote (rides created with fareMode "auto") ---
  // pricePerSeat = max(FARE_MIN, round(FARE_BASE + FARE_RATE_PER_KM x road km))
  FARE_BASE: num('FARE_BASE', 10),
  FARE_RATE_PER_KM: num('FARE_RATE_PER_KM', 3),
  FARE_MIN: num('FARE_MIN', 20),
  FARE_ROUND_TO: num('FARE_ROUND_TO', 1), // round fares to the nearest N rupees

  // --- Routing / geocoding (public OSM services by default) ---
  OSRM_BASE_URL: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
  NOMINATIM_BASE_URL: process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',
  NOMINATIM_COUNTRY_CODES: process.env.NOMINATIM_COUNTRY_CODES || 'in',
  GEO_USER_AGENT: process.env.GEO_USER_AGENT || 'CarpoolConnect/1.0 (set GEO_USER_AGENT with your contact email)',
  ETA_CACHE_MS: num('ETA_CACHE_MS', 20000),

  EMERGENCY_CONTACTS: loadEmergencyContacts()
};
