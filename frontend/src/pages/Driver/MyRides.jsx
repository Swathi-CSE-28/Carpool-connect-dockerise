import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Car, Trash2, Users, Play, Radio } from 'lucide-react';
import { rideService } from '../../services/rideService';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';

const STAGE_LABELS = {
  scheduled: 'Scheduled', preparing: 'Driver is preparing', started: 'Trip started',
  pickup_in_progress: 'Pickup in progress', on_the_way: 'On the way',
  reached: 'Destination reached', completed: 'Trip completed', cancelled: 'Cancelled'
};

function RideRow({ ride, onChanged }) {
  const handleCancel = async () => {
    await rideService.remove(ride._id);
    onChanged();
  };

  return (
    <div className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{ride.origin.label} → {ride.destination.label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {new Date(ride.departureTime).toLocaleString()} · <Users className="inline h-3.5 w-3.5" /> {ride.seatsAvailable}/{ride.totalSeats}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={ride.status === 'cancelled' ? 'red' : ride.status === 'completed' ? 'green' : 'blue'}>
          {STAGE_LABELS[ride.status]}
        </Badge>
        <Link to={`/driver/requests?ride=${ride._id}`} className="btn-secondary text-sm">Requests</Link>
        {['scheduled', 'preparing'].includes(ride.status) && (
          <Link to={`/driver/ride/${ride._id}`} className="btn-primary text-sm"><Play className="h-4 w-4" /> Start Ride</Link>
        )}
        {['started', 'pickup_in_progress', 'on_the_way', 'reached'].includes(ride.status) && (
          <Link to={`/driver/ride/${ride._id}`} className="btn-primary text-sm"><Radio className="h-4 w-4" /> Live tracking</Link>
        )}
        {ride.status !== 'cancelled' && (
          <button onClick={handleCancel} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MyRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await rideService.getMine();
    setRides(data.rides);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader label="Loading your rides..." />;

  if (rides.length === 0) {
    return <EmptyState icon={Car} title="You haven't offered any rides yet" message="Publish your first ride to start carrying passengers." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Rides</h1>
      {rides.map((r) => <RideRow key={r._id} ride={r} onChanged={load} />)}
    </div>
  );
}
