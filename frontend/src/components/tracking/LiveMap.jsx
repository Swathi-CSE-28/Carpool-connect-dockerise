import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Crosshair } from 'lucide-react';

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DEFAULT_CENTER = [9.17, 77.87]; // only used until real coordinates arrive
const ANIMATION_MS = 1000;

// divIcons keep the bundle free of image assets (Leaflet's default icons break under bundlers).
const pin = (cls, label) =>
  L.divIcon({
    className: 'cc-marker-wrap',
    html: `<div class="cc-pin ${cls}"><span>${label}</span></div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    tooltipAnchor: [0, -30]
  });

const ICONS = {
  pickup: pin('cc-pin-pickup', 'P'),
  destination: pin('cc-pin-dest', 'D'),
  origin: pin('cc-pin-origin', 'S'),
  driver: L.divIcon({
    className: 'cc-marker-wrap',
    html: '<div class="cc-driver"><div class="cc-driver-pulse"></div><div class="cc-driver-dot"></div></div>',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  })
};

/** Marker that glides to each new position instead of jumping. */
function AnimatedMarker({ position, icon, children }) {
  const markerRef = useRef(null);
  const frameRef = useRef(null);
  const currentRef = useRef(position);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !position) return undefined;
    const from = currentRef.current || position;
    const to = position;
    const start = performance.now();
    cancelAnimationFrame(frameRef.current);

    const step = (now) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      const lat = from[0] + (to[0] - from[0]) * t;
      const lng = from[1] + (to[1] - from[1]) * t;
      marker.setLatLng([lat, lng]);
      currentRef.current = [lat, lng];
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [position?.[0], position?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!position) return null;
  return (
    <Marker ref={markerRef} position={currentRef.current || position} icon={icon} zIndexOffset={1000}>
      {children}
    </Marker>
  );
}

/** Bridges the Leaflet map instance out to the wrapper (for recenter) and reports manual panning. */
function MapBridge({ mapRef, onUserMove }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  useMapEvents({ dragstart: () => onUserMove?.() });
  return null;
}

/** Keeps the driver in view when following; otherwise fits everything once. */
function ViewController({ driver, following, fitPoints, autoFit, routePoints }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fitPoints.length === 0 || (fittedRef.current && !autoFit)) return;
    const all = autoFit && routePoints?.length > 1 ? [...fitPoints, ...routePoints] : fitPoints;
    if (all.length === 1) map.setView(all[0], 15);
    else map.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 16 });
    fittedRef.current = true;
  }, [fitPoints, routePoints, autoFit, map]);

  useEffect(() => {
    if (following && driver) map.panTo(driver, { animate: true, duration: 0.8 });
  }, [driver?.[0], driver?.[1], following]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const LiveMap = forwardRef(function LiveMap(
  { driver, accuracy, origin, pickup, pickups, destination, route, trail, showAccuracy = true, statusOverlay, autoFit = false, hideRecenter = false, height = 'h-[55vh] min-h-[320px] lg:h-[70vh]' },
  ref
) {
  const mapRef = useRef(null);
  const [following, setFollowing] = useState(true);

  useImperativeHandle(ref, () => ({ recenter: () => setFollowing(true) }));

  const driverPos = driver ? [driver.lat, driver.lng] : null;
  const pts = (p) => (p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? [p.lat, p.lng] : null);
  const originPos = pts(origin);
  const pickupPos = pts(pickup);
  const destPos = pts(destination);

  const fitPoints = useMemo(
    () => [driverPos, pickupPos, destPos, originPos].filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driverPos?.[0], driverPos?.[1], pickupPos?.[0], pickupPos?.[1], destPos?.[0], destPos?.[1], originPos?.[0], originPos?.[1]]
  );

  const handleRecenter = () => {
    setFollowing(true);
    if (driverPos && mapRef.current) mapRef.current.setView(driverPos, Math.max(mapRef.current.getZoom(), 15), { animate: true });
  };

  return (
    <div className={`cc-map-shell relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 ${height}`}>
      <MapContainer center={fitPoints[0] || DEFAULT_CENTER} zoom={13} scrollWheelZoom className="h-full w-full" zoomControl>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <MapBridge mapRef={mapRef} onUserMove={() => setFollowing(false)} />
        <ViewController driver={driverPos} following={following && !autoFit} fitPoints={fitPoints} autoFit={autoFit} routePoints={route} />

        {route?.length > 1 && <Polyline positions={route} pathOptions={{ color: '#7c3aed', weight: 5, opacity: 0.75 }} />}
        {trail?.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#06b6d4', weight: 4, opacity: 0.9 }} />}

        {originPos && <Marker position={originPos} icon={ICONS.origin}><Tooltip>{origin.label || 'Start'}</Tooltip></Marker>}
        {(pickups || []).map((sp, i) => (pts(sp) ? <Marker key={`stop-${i}`} position={pts(sp)} icon={ICONS.pickup}><Tooltip>{sp.label || `Pickup ${i + 1}`}</Tooltip></Marker> : null))}
        {pickupPos && <Marker position={pickupPos} icon={ICONS.pickup}><Tooltip>Pickup: {pickup.label}</Tooltip></Marker>}
        {destPos && <Marker position={destPos} icon={ICONS.destination}><Tooltip>Destination: {destination.label}</Tooltip></Marker>}

        {driverPos && showAccuracy && accuracy > 0 && (
          <Circle center={driverPos} radius={accuracy} pathOptions={{ color: '#06b6d4', weight: 1, fillOpacity: 0.12 }} />
        )}
        <AnimatedMarker position={driverPos} icon={ICONS.driver}>
          <Tooltip>Driver</Tooltip>
        </AnimatedMarker>
      </MapContainer>

      {statusOverlay && <div className="pointer-events-none absolute left-3 top-3 z-[500]">{statusOverlay}</div>}

      {!hideRecenter && <button
        type="button"
        onClick={handleRecenter}
        disabled={!driverPos}
        aria-label="Recenter on driver"
        title={driverPos ? 'Recenter on driver' : 'Waiting for the driver’s location'}
        className={`absolute bottom-6 right-3 z-[500] flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-card transition disabled:opacity-50 ${
          following && driverPos ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-100'
        }`}
      >
        {following ? <LocateFixed className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
        {following ? 'Following' : 'Recenter'}
      </button>}
    </div>
  );
});

export default LiveMap;
