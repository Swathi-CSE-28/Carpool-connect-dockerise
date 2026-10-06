import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Check, X } from 'lucide-react';
import { rideService } from '../../services/rideService';
import { bookingService } from '../../services/bookingService';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';

const STATUS_VARIANT = { pending: 'yellow', accepted: 'green', rejected: 'red', cancelled: 'slate', completed: 'blue' };

export default function PassengerRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [myRides, setMyRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState(searchParams.get('ride') || '');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rideService.getMine().then((data) => {
      setMyRides(data.rides);
      if (!selectedRide && data.rides.length) setSelectedRide(data.rides[0]._id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookings = useCallback(async () => {
    if (!selectedRide) return;
    setLoading(true);
    const data = await bookingService.getForRide(selectedRide);
    setBookings(data.bookings);
    setLoading(false);
  }, [selectedRide]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleDecision = async (id, status) => {
    await bookingService.updateStatus(id, status);
    loadBookings();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="h-6 w-6" /> Passenger Requests</h1>

      <select
        className="input max-w-md"
        value={selectedRide}
        onChange={(e) => { setSelectedRide(e.target.value); setSearchParams({ ride: e.target.value }); }}
      >
        {myRides.map((r) => (
          <option key={r._id} value={r._id}>{r.origin.label} → {r.destination.label} ({new Date(r.departureTime).toLocaleDateString()})</option>
        ))}
      </select>

      {loading ? (
        <Loader label="Loading requests..." />
      ) : bookings.length === 0 ? (
        <EmptyState icon={Users} title="No requests for this ride yet" />
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <div key={b._id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: b.passenger?.avatarColor || '#7c3aed' }}
                >
                  {b.passenger?.name?.[0]?.toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold">{b.passenger?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{b.seatsRequested} seat(s) requested</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                {b.status === 'pending' && (
                  <>
                    <button onClick={() => handleDecision(b._id, 'accepted')} className="rounded-lg bg-emerald-100 p-2 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30">
                      <Check className="h-4.5 w-4.5" />
                    </button>
                    <button onClick={() => handleDecision(b._id, 'rejected')} className="rounded-lg bg-rose-100 p-2 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
