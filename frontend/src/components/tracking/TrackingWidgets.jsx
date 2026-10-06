import { useEffect, useState } from 'react';
import {
  Wifi, WifiOff, Radio, CheckCircle2, Circle, Phone, Siren, Car, Star, ShieldCheck,
  Navigation, Clock, Route, Gauge, Receipt, AlertTriangle, Loader2, MapPin
} from 'lucide-react';
import Badge from '../common/Badge';
import { trackingService } from '../../services/trackingService';
import { formatDistance, formatKm, formatDuration, formatClock, timeAgo, money, TIMELINE } from '../../utils/tracking';

/** Connection + live-GPS state pills. */
export function ConnectionBadge({ connection }) {
  const map = {
    connected: { variant: 'green', icon: Wifi, text: 'Connected' },
    connecting: { variant: 'yellow', icon: Loader2, text: 'Connecting…' },
    reconnecting: { variant: 'yellow', icon: Loader2, text: 'Reconnecting…' },
    disconnected: { variant: 'red', icon: WifiOff, text: 'Disconnected' }
  };
  const m = map[connection] || map.disconnected;
  return <Badge variant={m.variant} icon={m.icon}>{m.text}</Badge>;
}

export function LiveIndicator({ live, paused }) {
  if (paused) return <Badge variant="yellow" icon={Radio}>Tracking paused</Badge>;
  return live ? (
    <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
      Live GPS
    </span>
  ) : (
    <Badge variant="slate" icon={Radio}>Not live</Badge>
  );
}

/** Ride status timeline (Scheduled → … → Completed / Cancelled). */
export function StatusTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
        <AlertTriangle className="h-4 w-4" /> This ride was cancelled.
      </div>
    );
  }
  const current = Math.max(0, TIMELINE.findIndex((s) => s.statuses.includes(status)));
  return (
    <ol className="flex flex-col gap-3" aria-label="Ride status">
      {TIMELINE.map((step, i) => {
        const done = i < current || status === 'completed';
        const active = i === current && status !== 'completed';
        return (
          <li key={step.key} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
            {done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : active ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center"><span className="h-3.5 w-3.5 animate-pulse rounded-full bg-brand-600" /></span>
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
            )}
            <span className={`text-sm ${active ? 'font-semibold text-brand-700 dark:text-brand-300' : done ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

/** Planned distance / travelled distance / remaining distance / ETA. */
export function DistanceEtaCards({ plannedKm, travelledKm, eta, etaTargetLabel }) {
  const etaOk = eta?.available;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat icon={Route} label="Planned distance" value={formatKm(plannedKm)} hint="Estimated route" />
      <Stat
        icon={Gauge}
        label="Distance travelled"
        value={travelledKm === null || travelledKm === undefined ? '—' : formatKm(travelledKm)}
        hint="Measured by GPS on the server"
      />
      <Stat
        icon={Navigation}
        label={`Remaining${etaTargetLabel ? ` to ${etaTargetLabel}` : ''}`}
        value={etaOk ? formatDistance(eta.remainingMeters) : '—'}
        hint={!etaOk && eta?.straightLineMeters ? `≈ ${formatDistance(eta.straightLineMeters)} in a straight line` : etaOk ? 'By road' : undefined}
      />
      <Stat
        icon={Clock}
        label="Estimated arrival"
        value={etaOk ? new Date(eta.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        hint={etaOk ? `${formatDuration(eta.durationSec)} · no live traffic` : eta?.message || 'Available once the driver is moving'}
      />
    </div>
  );
}

/** Estimated vs final fare, always saying which basis is used. */
export function FareSummary({ fare, finalFare, policy }) {
  const est = fare?.estimated;
  const actualPolicy = policy === 'actual';
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Receipt className="h-4 w-4" /> Fare</div>
      {finalFare ? (
        <>
          <div className="text-2xl font-bold">{money(finalFare.totalAmount)}</div>
          <Badge variant={finalFare.basis === 'actual' ? 'purple' : 'blue'}>
            {finalFare.basis === 'actual' ? 'Billed on distance travelled' : 'Billed on estimated route (listed price)'}
          </Badge>
          <p className="text-xs text-slate-500 dark:text-slate-400">{finalFare.basisReason}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <dt>Per seat</dt><dd className="text-right">{money(finalFare.perSeatAmount)}</dd>
            <dt>Seats</dt><dd className="text-right">{finalFare.seats}</dd>
            <dt>Planned</dt><dd className="text-right">{formatKm(finalFare.plannedDistanceKm)}</dd>
            <dt>Travelled</dt><dd className="text-right">{formatKm(finalFare.actualDistanceKm)}</dd>
          </dl>
          <p className="text-xs text-slate-500">Payment status: pending — settle with your driver as agreed.</p>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold">{money(est?.totalAmount)}</div>
          <Badge variant={actualPolicy && fare?.agreedToDistanceBilling ? 'purple' : 'blue'}>
            {actualPolicy && fare?.agreedToDistanceBilling ? 'Estimate — final fare uses distance travelled' : 'Fixed: estimated route price'}
          </Badge>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {actualPolicy && fare?.agreedToDistanceBilling
              ? `You agreed to distance-based billing. The final amount is set by the server when the ride ends (capped at 125% of the planned distance).`
              : 'Route deviations are not charged. This is the price shown when you booked.'}
          </p>
        </>
      )}
    </div>
  );
}

export function DriverCard({ driver, showContact }) {
  if (!driver) return null;
  const v = driver.vehicle || {};
  const vehicleText = [v.color, v.make, v.model].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: driver.avatarColor || '#7c3aed' }}>
          {driver.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="flex items-center gap-1.5 font-semibold">
            {driver.name}
            {driver.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Verified profile" />}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            {driver.ratingCount ? `${driver.ratingAverage?.toFixed?.(1)} (${driver.ratingCount})` : 'No ratings yet'}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        <Car className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        {vehicleText || v.plateNumber ? (
          <div>
            <p className="font-medium">{vehicleText || 'Vehicle'}</p>
            {v.plateNumber && <p className="font-mono text-xs tracking-wider text-slate-600 dark:text-slate-300">{v.plateNumber}</p>}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">The driver hasn’t added vehicle details yet.</p>
        )}
      </div>
      {showContact && (
        driver.phone ? (
          <a href={`tel:${driver.phone.replace(/\s+/g, '')}`} className="btn-secondary text-sm"><Phone className="h-4 w-4" /> Contact driver</a>
        ) : (
          <p className="text-xs text-slate-500">No phone number on file for this driver.</p>
        )
      )}
    </div>
  );
}

export function PlacesCard({ origin, pickup, destination }) {
  const Row = ({ color, label, place }) => (
    <li className="flex items-start gap-2">
      <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div><p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><p className="text-sm font-medium">{place?.label || '—'}</p></div>
    </li>
  );
  return (
    <ul className="flex flex-col gap-3">
      {origin && <Row color="text-emerald-600" label="Starts at" place={origin} />}
      {pickup && <Row color="text-sky-600" label="Your pickup" place={pickup} />}
      <Row color="text-rose-600" label="Destination" place={destination} />
    </ul>
  );
}

/** Emergency shortcut: reveals the configured emergency numbers (from the server's EMERGENCY_CONTACTS). */
export function EmergencyPanel() {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || contacts) return;
    trackingService.getEmergencyContacts().then(setContacts).catch(() => setError(true));
  }, [open, contacts]);

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-rose-700">
        <Siren className="h-4 w-4" /> Emergency assistance
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-900/10">
          {error && <p className="text-sm text-rose-700">Couldn’t load emergency numbers. Dial your local emergency number directly.</p>}
          {!contacts && !error && <p className="text-sm text-slate-500">Loading…</p>}
          <ul className="flex flex-col gap-2">
            {(contacts || []).map((c) => (
              <li key={c.number + c.label}>
                <a href={`tel:${c.number}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm dark:bg-slate-900">
                  <span>{c.label}</span><span className="flex items-center gap-1 font-mono text-rose-600"><Phone className="h-3.5 w-3.5" />{c.number}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">You can also use the red SOS button at the bottom-left to alert the CarPool Connect safety team.</p>
        </div>
      )}
    </div>
  );
}

/** "Last updated 5 s ago · accuracy ±12 m" line. */
export function FreshnessLine({ timestamp, accuracy, now }) {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Last update: <span className="font-medium">{timestamp ? `${formatClock(timestamp)} (${timeAgo(timestamp, now)})` : 'none yet'}</span>
      {Number.isFinite(accuracy) && <> · GPS accuracy <span className="font-medium">±{Math.round(accuracy)} m</span></>}
    </p>
  );
}

export function Notice({ tone = 'info', icon: Icon = AlertTriangle, title, children }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200',
    error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-200',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200'
  };
  return (
    <div role="status" className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div>
    </div>
  );
}
