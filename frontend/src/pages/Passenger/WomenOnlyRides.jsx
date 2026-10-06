import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { rideService } from '../../services/rideService';
import RideCard from '../../components/rides/RideCard';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

export default function WomenOnlyRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rideService.getWomenOnly().then((data) => setRides(data.rides)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading Women-Only rides..." />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-brand-600" /> Women-Only Rides</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A matching preference verified on our server — not a guarantee of safety. See our{' '}
          <a href="/safety" className="text-brand-600 hover:underline">safety information</a>.
        </p>
      </div>
      {rides.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No Women-Only rides right now" message="Check back later or search all rides instead." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rides.map((ride) => <RideCard key={ride._id} ride={ride} />)}
        </div>
      )}
    </div>
  );
}
