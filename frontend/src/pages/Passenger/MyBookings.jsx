import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Radio } from 'lucide-react';
import { useBookings } from '../../hooks/useBookings';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { money, formatKm } from '../../utils/tracking';

const STATUS_VARIANT = { pending: 'yellow', accepted: 'green', rejected: 'red', cancelled: 'slate', completed: 'blue' };

export default function MyBookings() {
  const { bookings, loading, fetchMyBookings, cancelBooking } = useBookings();

  useEffect(() => { fetchMyBookings(); }, [fetchMyBookings]);

  if (loading) return <Loader label="Loading your bookings..." />;

  if (bookings.length === 0) {
    return <EmptyState icon={ListChecks} title="No bookings yet" message="Once you request a seat on a ride, it'll show up here." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Bookings</h1>
      {bookings.map((b) => (
        <div key={b._id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{b.ride?.origin?.label} → {b.ride?.destination?.label}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {b.ride?.driver?.name} · {new Date(b.ride?.departureTime).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {b.fare?.finalizedAt && (
              <span className="text-right text-xs text-slate-500 dark:text-slate-400">
                <b className="text-sm text-slate-800 dark:text-slate-100">{money(b.fare.totalAmount)}</b><br />
                {b.fare.basis === 'actual' ? `by distance (${formatKm(b.fare.actualDistanceKm)})` : 'estimated route price'} · payment {b.paymentStatus}
              </span>
            )}
            {b.status === 'accepted' && b.ride?.status !== 'cancelled' && (
              <Link to={`/passenger/track/${b.ride?._id}`} className="btn-primary !px-3 !py-2 text-sm"><Radio className="h-4 w-4" /> Track My Ride Live</Link>
            )}
            {b.status === 'completed' && (
              <Link to={`/passenger/track/${b.ride?._id}`} className="text-sm font-medium text-brand-600 hover:underline">Trip summary</Link>
            )}
            <Badge variant={STATUS_VARIANT[b.status] || 'slate'}>{b.status}</Badge>
            {['pending', 'accepted'].includes(b.status) && (
              <button onClick={() => cancelBooking(b._id)} className="text-sm font-medium text-rose-600 hover:underline">
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
