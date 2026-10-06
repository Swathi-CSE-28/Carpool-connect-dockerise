import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, Square, MapPin, ShieldCheck, Phone, RefreshCw, Flag, PlayCircle, LocateFixed,
  WifiOff, CheckCircle2, XCircle, Loader2, AlertTriangle
} from 'lucide-react';
import { useRideTracking } from '../../hooks/useRideTracking';
import { useDriverGps, requestFirstFix } from '../../hooks/useDriverGps';
import { useNow } from '../../hooks/useNow';
import { trackingService } from '../../services/trackingService';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import LiveMap from '../../components/tracking/LiveMap';
import {
  ConnectionBadge, LiveIndicator, StatusTimeline, DistanceEtaCards, EmergencyPanel, FreshnessLine, Notice
} from '../../components/tracking/TrackingWidgets';
import { decodePolyline, STATUS_LABELS, formatKm, money } from '../../utils/tracking';

const NEXT_STEP = {
  started: { step: 'arrived_pickup', label: 'Arrived at pickup', icon: MapPin },
  pickup_in_progress: { step: 'in_progress', label: 'Start trip (passengers on board)', icon: PlayCircle },
  on_the_way: { step: 'reached', label: 'Reached destination', icon: Flag }
};

const errText = (err) => (typeof err === 'string' ? err : err?.message || 'Something went wrong');

export default function DriveRide() {
  const { rideId } = useParams();
  const now = useNow(1000);
  const [showConsent, setShowConsent] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [summary, setSummary] = useState(null);

  const t = useRideTracking(rideId);
  const gps = useDriverGps({
    rideId,
    getSocket: () => t.socket.current,
    onFatal: (info) => {
      setActionError(info.message);
      t.refresh();
    }
  });

  const { snapshot, trackingState, rideStatus, endedReason } = t;
  const routeLine = useMemo(() => decodePolyline(t.route?.geometry), [t.route?.geometry]);

  const run = useCallback(async (name, fn) => {
    setBusy(name);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(errText(err));
    } finally {
      setBusy(null);
    }
  }, []);

  // Location permission is requested BEFORE anything changes on the server, so a
  // denied prompt leaves the ride untouched.
  const handleStart = () => run('start', async () => {
    setShowConsent(false);
    const first = await requestFirstFix();
    await trackingService.start(rideId);
    await t.refresh();
    await gps.start(first);
  });

  const handleResume = () => run('resume', async () => {
    const first = await requestFirstFix();
    await trackingService.resume(rideId);
    await t.refresh();
    await gps.start(first);
  });

  // Ride is live on the server but this device isn't sharing (page was reloaded/reopened).
  const handleShareAgain = () => run('share', async () => {
    const first = await requestFirstFix();
    await gps.start(first);
  });

  const handlePause = () => run('pause', async () => {
    await trackingService.pause(rideId);
    gps.stop();
    await t.refresh();
  });

  const handleProgress = (step) => run('progress', async () => {
    await trackingService.setProgress(rideId, step);
    await t.refresh();
  });

  const handleEnd = () => run('end', async () => {
    setConfirmEnd(false);
    gps.stop(); // stop reading GPS first so nothing else is sent after the ride closes
    const res = await trackingService.end(rideId);
    setSummary(res);
    await t.refresh();
  });

  if (t.loading && !snapshot) return <Loader label="Loading your ride…" />;

  if (!snapshot) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Notice tone="error" icon={XCircle} title="Can’t open this ride">{t.error || 'This ride could not be loaded.'}</Notice>
        <Link to="/driver/my-rides" className="btn-secondary text-sm"><ArrowLeft className="h-4 w-4" /> My rides</Link>
      </div>
    );
  }

  const isLive = ['active', 'paused'].includes(trackingState);
  const finished = rideStatus === 'completed' || rideStatus === 'cancelled' || trackingState === 'ended';
  const canStart = trackingState === 'idle' && ['scheduled', 'preparing'].includes(rideStatus);
  const deviceNotSharing = trackingState === 'active' && !gps.sharing && !busy;
  const nextStep = trackingState === 'active' ? NEXT_STEP[rideStatus] : null;

  const mapDriver = gps.position
    ? { lat: gps.position.latitude, lng: gps.position.longitude }
    : isLive && t.location ? { lat: t.location.latitude, lng: t.location.longitude } : null;
  const accuracy = gps.position?.accuracy ?? t.location?.accuracy;
  const distanceKm = gps.distanceMeters !== null ? Math.round(gps.distanceMeters / 10) / 100 : t.distanceKm;
  const weakGps = Number.isFinite(accuracy) && accuracy > 50;
  const browserOffline = !gps.online;

  const overlay = (
    <div className="flex flex-wrap gap-2">
      <LiveIndicator live={gps.sharing} paused={trackingState === 'paused'} />
      <ConnectionBadge connection={browserOffline ? 'disconnected' : t.connection} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/driver/my-rides" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> My rides</Link>
          <h1 className="text-2xl font-bold">Drive &amp; share live location</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{snapshot.ride.origin.label} → {snapshot.ride.destination.label}</p>
        </div>
        <Badge variant={rideStatus === 'cancelled' ? 'red' : rideStatus === 'completed' ? 'green' : 'purple'}>{STATUS_LABELS[rideStatus] || rideStatus}</Badge>
      </div>

      {actionError && <Notice tone="error" icon={AlertTriangle} title="Something needs your attention">{actionError}</Notice>}
      {browserOffline && isLive && (
        <Notice tone="warn" icon={WifiOff} title="You’re offline">Location updates are paused until your connection returns. Nothing is queued — sharing resumes automatically.</Notice>
      )}
      {gps.gpsError && !gps.gpsError.fatal && <Notice tone="warn" icon={LocateFixed} title="GPS issue">{gps.gpsError.message}</Notice>}
      {weakGps && gps.sharing && (
        <Notice tone="warn" icon={LocateFixed} title="Weak GPS signal">Accuracy is ±{Math.round(accuracy)} m. Readings worse than ±50 m are shown but not counted toward distance.</Notice>
      )}
      {gps.serverNote && gps.sharing && <Notice tone="info">{gps.serverNote}</Notice>}
      {deviceNotSharing && (
        <Notice tone="warn" icon={LocateFixed} title="This device isn’t sharing its location">
          The ride is still live, but passengers see no updates. Tap “Resume sharing” to continue.
        </Notice>
      )}
      {finished && (
        <Notice tone={rideStatus === 'cancelled' ? 'error' : 'ok'} icon={rideStatus === 'cancelled' ? XCircle : CheckCircle2}
          title={rideStatus === 'cancelled' ? 'This ride was cancelled' : 'Ride completed'}>
          Location sharing has stopped and this ride’s location data has been deleted.
          {summary && <> Final measured distance: <b>{formatKm(summary.actualDistanceKm)}</b>. {summary.fares.length} passenger booking(s) billed, total <b>{money(summary.fares.reduce((n, f) => n + f.fare.totalAmount, 0))}</b>.</>}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <LiveMap
            driver={mapDriver}
            accuracy={accuracy}
            origin={snapshot.ride.origin}
            destination={snapshot.ride.destination}
            pickup={snapshot.passengers?.[0]?.pickup}
            route={routeLine}
            trail={isLive ? t.trail : []}
            statusOverlay={overlay}
          />
          <div className="flex flex-col gap-1">
            <FreshnessLine timestamp={gps.position?.timestamp} accuracy={accuracy} now={now} />
            {gps.lastSentAt && <p className="text-xs text-slate-500 dark:text-slate-400">Last sent to passengers: {new Date(gps.lastSentAt).toLocaleTimeString()}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-3">
            <h2 className="section-title">Ride controls</h2>

            {canStart && (
              <button disabled={!!busy} onClick={() => setShowConsent(true)} className="btn-primary">
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start Ride
              </button>
            )}

            {deviceNotSharing && (
              <button disabled={!!busy} onClick={handleShareAgain} className="btn-primary"><LocateFixed className="h-4 w-4" /> Resume sharing</button>
            )}

            {nextStep && (
              <button disabled={!!busy} onClick={() => handleProgress(nextStep.step)} className="btn-secondary">
                <nextStep.icon className="h-4 w-4" /> {nextStep.label}
              </button>
            )}

            {trackingState === 'active' && (
              <button disabled={!!busy} onClick={handlePause} className="btn-secondary"><Pause className="h-4 w-4" /> Pause Tracking</button>
            )}
            {trackingState === 'paused' && (
              <button disabled={!!busy} onClick={handleResume} className="btn-primary"><Play className="h-4 w-4" /> Resume Tracking</button>
            )}

            {isLive && !confirmEnd && (
              <button disabled={!!busy} onClick={() => setConfirmEnd(true)} className="btn-secondary !border-rose-300 !text-rose-600 hover:!bg-rose-50">
                <Square className="h-4 w-4" /> End Ride
              </button>
            )}
            {isLive && confirmEnd && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-900/10">
                <p className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-300">End this ride and finalize fares?</p>
                <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">Location sharing stops, the distance is locked in, and each passenger’s fare is calculated. This can’t be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmEnd(false)} className="btn-secondary flex-1 !py-2 text-sm">Keep going</button>
                  <button disabled={!!busy} onClick={handleEnd} className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                    {busy === 'end' ? 'Ending…' : 'End Ride'}
                  </button>
                </div>
              </div>
            )}

            {!isLive && !canStart && !finished && <p className="text-sm text-slate-500">This ride can’t be started right now.</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your device location is read only while tracking is on. It stops when you pause, end the ride, or leave this page.
            </p>
          </div>

          <div className="card"><h2 className="section-title mb-3">Ride status</h2><StatusTimeline status={rideStatus} /></div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <h2 className="section-title mb-3">Distance &amp; arrival</h2>
          <DistanceEtaCards plannedKm={snapshot.tracking.plannedDistanceKm} travelledKm={isLive || finished ? distanceKm : null} eta={isLive ? t.eta : null} etaTargetLabel="destination" />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Billing: <b>{snapshot.ride.fareBasis === 'actual' ? 'distance travelled (for passengers who agreed)' : 'estimated route price'}</b>. Distance is measured and locked by the server, not this device.
          </p>
        </div>

        <div className="card">
          <h2 className="section-title mb-3">Passengers ({snapshot.seatsBooked || 0} seat{snapshot.seatsBooked === 1 ? '' : 's'})</h2>
          {snapshot.passengers?.length ? (
            <ul className="flex flex-col gap-3">
              {snapshot.passengers.map((p) => (
                <li key={p.bookingId} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{p.name} · {p.seats} seat{p.seats > 1 ? 's' : ''}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pickup: {p.pickup?.label || '—'}</p>
                  </div>
                  {p.phone && <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800" aria-label={`Call ${p.name}`}><Phone className="h-4 w-4" /></a>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No confirmed passengers on this ride.</p>
          )}
        </div>

        <div className="card flex flex-col gap-3">
          <h2 className="section-title">Safety</h2>
          <EmergencyPanel />
          <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your live position is only visible to confirmed passengers on this ride.</p>
          <button onClick={t.refresh} className="btn-secondary text-sm"><RefreshCw className="h-4 w-4" /> Refresh ride data</button>
        </div>
      </div>

      {showConsent && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2"><LocateFixed className="h-5 w-5 text-brand-600" /><h2 id="consent-title" className="text-lg font-bold">Share your location for this ride?</h2></div>
            <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>Your browser will ask for permission to use your device’s GPS.</li>
              <li>Your position is shown live to passengers with a confirmed booking on this ride — nobody else.</li>
              <li>The server uses it to measure distance travelled for fare calculation.</li>
              <li>It runs only while this ride is active. Pause, end the ride, or leave this page to stop it. There is no background tracking.</li>
              <li>Location data for the ride is deleted when the ride ends.</li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setShowConsent(false)} className="btn-secondary flex-1">Not now</button>
              <button onClick={handleStart} className="btn-primary flex-1">Allow &amp; start ride</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
