import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPinOff, RefreshCw, Hourglass, PauseCircle, CheckCircle2, XCircle, WifiOff, SatelliteDish } from 'lucide-react';
import { useRideTracking } from '../../hooks/useRideTracking';
import { useNow } from '../../hooks/useNow';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import LiveMap from '../../components/tracking/LiveMap';
import {
  ConnectionBadge, LiveIndicator, StatusTimeline, DistanceEtaCards, FareSummary, DriverCard,
  PlacesCard, EmergencyPanel, FreshnessLine, Notice
} from '../../components/tracking/TrackingWidgets';
import { decodePolyline, STATUS_LABELS, timeAgo } from '../../utils/tracking';

const STALE_AFTER_MS = 45000;

export default function TrackRide() {
  const { rideId } = useParams();
  const now = useNow(1000);
  const t = useRideTracking(rideId);
  const { snapshot, location, trackingState, rideStatus, endedReason, connection } = t;

  const routeLine = useMemo(() => decodePolyline(t.route?.geometry), [t.route?.geometry]);

  if (t.loading && !snapshot) return <Loader label="Loading live tracking…" />;

  if (!snapshot) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Notice tone="error" icon={MapPinOff} title="Live tracking isn’t available for this ride">
          {t.error || 'Live tracking is only available for your own confirmed bookings.'}
        </Notice>
        <div className="flex gap-2">
          <Link to="/passenger/bookings" className="btn-secondary text-sm"><ArrowLeft className="h-4 w-4" /> My bookings</Link>
          <button onClick={t.refresh} className="btn-primary text-sm"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      </div>
    );
  }

  const isLive = ['active', 'paused'].includes(trackingState) && !endedReason;
  const stale = isLive && trackingState === 'active' && location && now - location.timestamp > STALE_AFTER_MS;
  const mapDriver = isLive && location ? { lat: location.latitude, lng: location.longitude } : null;
  const etaTarget = t.eta?.target === 'pickup' ? 'your pickup' : 'destination';
  const browserOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const banner = (() => {
    if (endedReason === 'completed') {
      return <Notice tone="ok" icon={CheckCircle2} title="Ride completed">Live tracking has stopped and the driver’s location is no longer shared. Your final fare is shown below.</Notice>;
    }
    if (endedReason === 'ride_cancelled') {
      return <Notice tone="error" icon={XCircle} title="This ride was cancelled">The driver cancelled the ride, so live tracking has stopped.</Notice>;
    }
    if (endedReason?.startsWith('booking_')) {
      return <Notice tone="warn" icon={XCircle} title="Live tracking stopped">Your booking is no longer confirmed, so you can’t see this ride’s location.</Notice>;
    }
    if (trackingState === 'idle') {
      return <Notice tone="info" icon={Hourglass} title="The driver hasn’t started the ride yet">This page updates by itself as soon as they start — no need to refresh.</Notice>;
    }
    if (trackingState === 'paused') {
      return <Notice tone="warn" icon={PauseCircle} title="Driver paused location sharing">The map shows nothing new until the driver resumes.</Notice>;
    }
    if (isLive && !location) {
      return <Notice tone="info" icon={SatelliteDish} title="Ride started — waiting for the driver’s location">The first GPS position should arrive within a few seconds.</Notice>;
    }
    if (stale) {
      return <Notice tone="warn" icon={SatelliteDish} title="Driver location temporarily unavailable">Last seen {timeAgo(location.timestamp, now)}. This can happen in areas with poor signal — we’ll update as soon as new data arrives.</Notice>;
    }
    return null;
  })();

  const connectionBanner =
    (browserOffline || connection === 'disconnected' || connection === 'reconnecting') && !endedReason ? (
      <Notice tone="warn" icon={WifiOff} title={browserOffline ? 'You’re offline' : 'Connection to live updates lost'}>
        {browserOffline ? 'Reconnect to the internet to continue tracking.' : 'Trying to reconnect automatically. The map will catch up when the connection is back.'}
      </Notice>
    ) : null;

  const overlay = (
    <div className="flex flex-wrap gap-2">
      <LiveIndicator live={isLive && !!location && !stale} paused={trackingState === 'paused'} />
      <ConnectionBadge connection={browserOffline ? 'disconnected' : connection} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/passenger/bookings" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> My bookings</Link>
          <h1 className="text-2xl font-bold">Track my ride live</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{snapshot.ride.origin.label} → {snapshot.ride.destination.label}</p>
        </div>
        <Badge variant={rideStatus === 'cancelled' ? 'red' : rideStatus === 'completed' ? 'green' : 'purple'}>{STATUS_LABELS[rideStatus] || rideStatus}</Badge>
      </div>

      {banner}
      {connectionBanner}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <LiveMap
            driver={mapDriver}
            accuracy={location?.accuracy}
            origin={snapshot.ride.origin}
            pickup={snapshot.pickup}
            destination={snapshot.ride.destination}
            route={routeLine}
            trail={isLive ? t.trail : []}
            statusOverlay={overlay}
          />
          <FreshnessLine timestamp={isLive ? location?.timestamp : null} accuracy={isLive ? location?.accuracy : null} now={now} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="card"><h2 className="section-title mb-3">Ride status</h2><StatusTimeline status={rideStatus} /></div>
          <div className="card">
            <h2 className="section-title mb-3">Distance &amp; arrival</h2>
            <DistanceEtaCards
              plannedKm={snapshot.tracking.plannedDistanceKm}
              travelledKm={isLive || rideStatus === 'completed' ? t.distanceKm : null}
              eta={isLive ? t.eta : null}
              etaTargetLabel={isLive ? etaTarget : ''}
            />
          </div>
          <div className="card"><h2 className="section-title mb-3">Your trip</h2>
            <PlacesCard origin={snapshot.ride.origin} pickup={snapshot.pickup} destination={snapshot.ride.destination} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card"><h2 className="section-title mb-3">Your driver</h2><DriverCard driver={snapshot.driver} showContact={!endedReason || endedReason === 'completed'} /></div>
        <div className="card"><FareSummary fare={snapshot.fare} finalFare={t.finalFare} policy={snapshot.ride.fareBasis} /></div>
        <div className="card flex flex-col gap-3">
          <h2 className="section-title">Safety</h2>
          <EmergencyPanel />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only you, your driver and other confirmed passengers on this ride can see the driver’s live location, and only while the ride is active.
          </p>
        </div>
      </div>
    </div>
  );
}
