import { useCallback, useEffect, useRef, useState } from 'react';
import { createTrackingSocket } from '../services/socket';
import { trackingService } from '../services/trackingService';

const ETA_REFRESH_MS = 30000;

/**
 * Loads the tracking snapshot over REST and keeps it live over Socket.IO.
 *
 *  - authorization is enforced by the server on both the REST call and the room subscription
 *  - every (re)connect re-subscribes and refetches the snapshot to catch up on anything missed
 *  - the socket + all listeners are torn down when the component unmounts
 *
 * connection: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 * endedReason: null | 'completed' | 'ride_cancelled' | 'booking_cancelled' | 'booking_rejected'
 */
export function useRideTracking(rideId, { onDriverSocket } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState('connecting');
  const [location, setLocation] = useState(null);
  const [trail, setTrail] = useState([]);
  const [rideStatus, setRideStatus] = useState(null);
  const [trackingState, setTrackingState] = useState('idle');
  const [route, setRoute] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [eta, setEta] = useState(null);
  const [finalFare, setFinalFare] = useState(null);
  const [endedReason, setEndedReason] = useState(null);
  const socketRef = useRef(null);
  const mountedRef = useRef(true);

  const applySnapshot = useCallback((snap) => {
    setSnapshot(snap);
    setRideStatus(snap.ride.status);
    setTrackingState(snap.tracking.state);
    setRoute(snap.tracking.route);
    setDistanceKm(snap.tracking.actualDistanceKm);
    setLocation(snap.tracking.location);
    setTrail(snap.tracking.trail || []);
    if (snap.fare?.final) setFinalFare(snap.fare.final);
    if (snap.ride.status === 'completed') setEndedReason((r) => r || 'completed');
    if (snap.ride.status === 'cancelled') setEndedReason((r) => r || 'ride_cancelled');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snap = await trackingService.getSnapshot(rideId);
      if (!mountedRef.current) return null;
      applySnapshot(snap);
      setError(null);
      return snap;
    } catch (err) {
      if (mountedRef.current) setError(typeof err === 'string' ? err : 'Could not load tracking data');
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [rideId, applySnapshot]);

  const refreshEta = useCallback(async () => {
    try {
      const value = await trackingService.getEta(rideId);
      if (mountedRef.current) setEta(value);
    } catch (err) {
      if (mountedRef.current) setEta({ available: false, message: 'A reliable arrival time is not available right now.' });
    }
  }, [rideId]);

  // Snapshot + socket lifecycle
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    refresh();

    const socket = createTrackingSocket();
    socketRef.current = socket;
    if (onDriverSocket) onDriverSocket(socket);

    const subscribe = () =>
      socket.timeout(6000).emit('tracking:subscribe', { rideId }, (err, ack) => {
        if (err || !ack?.ok) {
          if (ack?.code === 'RIDE_ENDED') return; // finished rides are shown from the REST snapshot
          if (ack?.message) setError(ack.message);
        }
      });

    socket.on('connect', () => {
      setConnection('connected');
      subscribe();
      refresh(); // catch up on anything missed while disconnected
    });
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.io.on('reconnect_attempt', () => setConnection('reconnecting'));
    socket.on('connect_error', () => setConnection(socket.active ? 'reconnecting' : 'disconnected'));

    socket.on('tracking:location', (p) => {
      if (String(p.rideId) !== String(rideId)) return;
      setLocation({
        latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy ?? null,
        heading: p.heading ?? null, speed: p.speed ?? null, timestamp: p.timestamp
      });
      setDistanceKm(Math.round(p.distanceMeters / 10) / 100);
      setTrail((t) => [...t.slice(-299), [p.latitude, p.longitude]]);
    });
    socket.on('tracking:status', (p) => {
      if (String(p.rideId) !== String(rideId)) return;
      setRideStatus(p.rideStatus);
      setTrackingState(p.trackingState);
      if (p.trackingState === 'active' && p.rideStatus === 'started') refreshEta();
    });
    socket.on('tracking:route', (p) => {
      if (String(p.rideId) === String(rideId)) setRoute(p.route);
    });
    socket.on('tracking:fare', (p) => {
      if (String(p.rideId) === String(rideId)) setFinalFare(p.fare);
    });
    socket.on('tracking:ended', (p) => {
      if (String(p.rideId) !== String(rideId)) return;
      setEndedReason(p.reason);
      setTrackingState('ended');
      setLocation(null); // never keep showing a location after tracking has stopped
      setTrail([]);
      if (p.reason === 'completed') setRideStatus('completed');
      if (p.reason === 'ride_cancelled') setRideStatus('cancelled');
      refresh();
    });

    return () => {
      mountedRef.current = false;
      socket.emit('tracking:unsubscribe', { rideId });
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  // ETA: refresh on a timer while the ride is live, and when the first location arrives
  const hasLocation = !!location;
  useEffect(() => {
    if (!['active', 'paused'].includes(trackingState) || !hasLocation) return undefined;
    refreshEta();
    const id = setInterval(refreshEta, ETA_REFRESH_MS);
    return () => clearInterval(id);
  }, [trackingState, hasLocation, rideStatus, refreshEta]);

  return {
    snapshot, loading, error, connection, location, trail, rideStatus, trackingState,
    route, distanceKm, eta, finalFare, endedReason, refresh, refreshEta,
    socket: socketRef
  };
}
