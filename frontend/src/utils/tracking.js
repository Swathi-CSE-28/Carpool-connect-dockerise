// Small helpers shared by the tracking UI.

/** Decodes an encoded polyline (precision 5, as returned by OSRM) into [[lat, lng], ...]. */
export function decodePolyline(str, precision = 5) {
  if (!str) return [];
  const factor = 10 ** precision;
  const out = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const axis of ['lat', 'lng']) {
      let shift = 0;
      let result = 0;
      let byte;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index <= str.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

export function formatKm(km) {
  if (km === null || km === undefined || Number.isNaN(km)) return '—';
  return `${Number(km).toFixed(2)} km`;
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatClock(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "12 s ago", "3 min ago" - based on a `now` value so callers control re-rendering. */
export function timeAgo(ts, now = Date.now()) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export const money = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toFixed(2).replace(/\.00$/, '')}`);

// Ride statuses in the order the UI timeline shows them.
export const TIMELINE = [
  { key: 'scheduled', label: 'Scheduled', statuses: ['scheduled', 'preparing'] },
  { key: 'started', label: 'Driver En Route', statuses: ['started'] },
  { key: 'pickup_in_progress', label: 'Arrived at Pickup', statuses: ['pickup_in_progress'] },
  { key: 'on_the_way', label: 'In Progress', statuses: ['on_the_way', 'reached'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] }
];

export const STATUS_LABELS = {
  scheduled: 'Scheduled', preparing: 'Scheduled', started: 'Driver En Route',
  pickup_in_progress: 'Arrived at Pickup', on_the_way: 'In Progress', reached: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled'
};

export const isSecureForGeolocation = () =>
  typeof window !== 'undefined' &&
  (window.isSecureContext || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
