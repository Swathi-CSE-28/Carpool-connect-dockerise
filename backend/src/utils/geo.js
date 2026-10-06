const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two {lat,lng} points. */
function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function isValidLatLng(lat, lng) {
  return isFiniteNumber(lat) && isFiniteNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// "Null Island" (0,0) is what a failed GPS fix often reports - never a real ride location here.
const isNullIsland = (lat, lng) => lat === 0 && lng === 0;

module.exports = { haversineMeters, isValidLatLng, isNullIsland, isFiniteNumber };
