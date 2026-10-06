import { Link } from 'react-router-dom';
import { MapPin, Clock, Users, ShieldCheck, Star } from 'lucide-react';
import Badge from '../common/Badge';

export default function RideCard({ ride, matchInfo }) {
  const departure = new Date(ride.departureTime);

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: ride.driver?.avatarColor || '#7c3aed' }}
          >
            {ride.driver?.name?.[0]?.toUpperCase() || 'D'}
          </span>
          <div>
            <p className="font-semibold">{ride.driver?.name || 'Driver'}</p>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {ride.driver?.ratingAverage?.toFixed(1) || 'New'} · {ride.driver?.completedRides || 0} rides
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {ride.womenOnly && <Badge variant="purple" icon={ShieldCheck}>Women-Only</Badge>}
          {matchInfo && <Badge variant="blue">Alternative match</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="flex flex-1 items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-600 shrink-0" />
          <span className="truncate">{ride.origin?.label}</span>
        </div>
        <span className="text-slate-400">→</span>
        <div className="flex flex-1 items-center gap-2">
          <MapPin className="h-4 w-4 text-accent-cyan shrink-0" />
          <span className="truncate">{ride.destination?.label}</span>
        </div>
      </div>

      {matchInfo?.reasons?.length > 0 && (
        <div className="rounded-lg bg-sky-50 dark:bg-sky-900/20 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
          {matchInfo.reasons.join(' · ')}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {departure.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {ride.seatsAvailable} / {ride.totalSeats} seats left
        </span>
        {ride.pricePerSeat > 0 && <span className="font-semibold text-brand-600">₹{ride.pricePerSeat}/seat</span>}
        {ride.distanceKm > 0 && <span className="text-slate-500 dark:text-slate-400">{ride.distanceKm} km{ride.fareMode === 'auto' ? ' by road' : ''}</span>}
      </div>

      <Link to={`/rides/${ride._id}`} className="btn-primary w-full">
        View details
      </Link>
    </div>
  );
}
