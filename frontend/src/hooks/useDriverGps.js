import { useCallback, useEffect, useRef, useState } from 'react';
import { trackingService } from '../services/trackingService';
import { isSecureForGeolocation } from '../utils/tracking';

const SEND_INTERVAL_MS = 4000; // client-side throttle (server also enforces its own minimum)
const GEO_OPTIONS = { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 };

const GEO_ERRORS = {
  1: { code: 'PERMISSION_DENIED', fatal: true, message: 'Location permission was denied. Allow location access for this site in your browser settings, then tap Resume.' },
  2: { code: 'POSITION_UNAVAILABLE', fatal: false, message: 'GPS is unavailable. Check that location services are switched on and you have a clear view of the sky.' },
  3: { code: 'TIMEOUT', fatal: false, message: 'Timed out waiting for a GPS fix. Still trying…' }
};

/** One-off permission + first-fix check. Resolves with the position or rejects with { code, message }. */
export function requestFirstFix() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject({ code: 'UNSUPPORTED', message: "This browser doesn't support geolocation." });
    }
    if (!isSecureForGeolocation()) {
      return reject({ code: 'INSECURE', message: 'Location access needs HTTPS. Open the app over https:// (localhost is the only exception).' });
    }
    return navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(GEO_ERRORS[err.code] || { code: 'UNKNOWN', message: err.message }),
      { ...GEO_OPTIONS, timeout: 15000 }
    );
  });
}

/**
 * Driver-side GPS publisher.
 *
 * Location is read ONLY while `start()` has been called and `stop()` hasn't:
 * nothing runs in the background, and the watch is cleared on unmount, so
 * leaving the page always stops sharing from this device.
 *
 * Readings go out over the (authenticated) socket; if it is down the HTTP
 * endpoint is used instead; if the browser is offline nothing is sent and the
 * UI says so. Only the newest reading is ever sent - old ones are never queued.
 */
export function useDriverGps({ rideId, getSocket, onFatal }) {
  const [sharing, setSharing] = useState(false);
  const [position, setPosition] = useState(null); // latest device reading {latitude, longitude, accuracy, timestamp}
  const [gpsError, setGpsError] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [serverNote, setServerNote] = useState(null); // e.g. "Reading ignored: poor accuracy"
  const [distanceMeters, setDistanceMeters] = useState(null); // authoritative value echoed by the server

  const watchId = useRef(null);
  const lastSendRef = useRef(0);
  const sharingRef = useRef(false);
  const onFatalRef = useRef(onFatal);
  onFatalRef.current = onFatal;

  const clear = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    sharingRef.current = false;
    setSharing(false);
  }, []);

  const handleAck = useCallback((res) => {
    if (!res) return;
    if (res.ok || res.accepted) {
      setLastSentAt(Date.now());
      if (typeof res.distanceMeters === 'number') setDistanceMeters(res.distanceMeters);
      setServerNote(res.skipReason === 'low_accuracy' ? 'Weak GPS signal: shown on the map but not counted toward distance.' : null);
      return;
    }
    switch (res.code) {
      case 'THROTTLED':
      case 'DUPLICATE':
      case 'OUT_OF_ORDER':
        return; // harmless
      case 'POOR_ACCURACY':
        setServerNote('GPS accuracy is too poor right now, so this reading was ignored.');
        return;
      case 'IMPLAUSIBLE_JUMP':
        setServerNote('The last reading jumped an implausible distance and was ignored.');
        return;
      case 'STALE':
        setServerNote('A delayed reading was ignored.');
        return;
      case 'PAUSED':
      case 'RIDE_ENDED':
      case 'NOT_STARTED':
      case 'NOT_AUTHORIZED':
        clear();
        onFatalRef.current?.(res);
        return;
      default:
        setServerNote(res.message || 'A reading was rejected by the server.');
    }
  }, [clear]);

  const send = useCallback(async (pos) => {
    const payload = {
      rideId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy,
      heading: Number.isFinite(pos.heading) ? pos.heading : undefined,
      speed: Number.isFinite(pos.speed) ? pos.speed : undefined,
      timestamp: pos.timestamp
    };
    const socket = getSocket?.();
    try {
      if (socket?.connected) {
        socket.timeout(5000).emit('tracking:location', payload, (err, res) => {
          if (err) setServerNote('The server did not acknowledge the last update (slow network).');
          else handleAck(res);
        });
      } else {
        const res = await trackingService.sendLocation(rideId, payload);
        handleAck(res);
      }
    } catch (err) {
      setServerNote(typeof err === 'string' ? err : 'Could not reach the server. Will retry with the next reading.');
    }
  }, [rideId, getSocket, handleAck]);

  const start = useCallback(async (prefetchedFix) => {
    setGpsError(null);
    setServerNote(null);
    if (sharingRef.current) return;
    const first = prefetchedFix || (await requestFirstFix()); // throws { code, message } for the UI
    sharingRef.current = true;
    setSharing(true);
    lastSendRef.current = 0;

    const onPosition = (p) => {
      const reading = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        heading: p.coords.heading,
        speed: p.coords.speed,
        timestamp: p.timestamp
      };
      setPosition(reading);
      setGpsError(null);
      const now = Date.now();
      if (now - lastSendRef.current < SEND_INTERVAL_MS) return;
      if (!navigator.onLine) return; // nothing is queued; the next reading after reconnecting goes out
      lastSendRef.current = now;
      send(reading);
    };
    const onError = (err) => {
      const mapped = GEO_ERRORS[err.code] || { code: 'UNKNOWN', fatal: false, message: err.message };
      setGpsError(mapped);
      if (mapped.fatal) {
        clear();
        onFatalRef.current?.({ code: mapped.code, message: mapped.message });
      }
    };

    onPosition(first);
    watchId.current = navigator.geolocation.watchPosition(onPosition, onError, GEO_OPTIONS);
  }, [send, clear]);

  // Online / offline awareness
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Leaving the page always stops location reading on this device.
  useEffect(() => clear, [clear]);

  return { sharing, position, gpsError, online, lastSentAt, serverNote, distanceMeters, start, stop: clear };
}
