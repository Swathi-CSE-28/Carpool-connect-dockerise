import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Car, Users, Star } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { rideService } from '../../services/rideService';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);

  useEffect(() => {
    rideService.getMine().then((data) => setRides(data.rides)).catch(() => {});
  }, []);

  const active = rides.filter((r) => r.status !== 'cancelled' && r.status !== 'completed');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Hey {user?.name?.split(' ')[0]}, ready to drive? 🚗</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your rides, requests and reputation from here.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card"><Car className="mb-2 h-6 w-6 text-brand-600" /><p className="text-2xl font-bold">{rides.length}</p><p className="text-sm text-slate-500 dark:text-slate-400">Total rides offered</p></div>
        <div className="card"><Users className="mb-2 h-6 w-6 text-accent-cyan" /><p className="text-2xl font-bold">{active.length}</p><p className="text-sm text-slate-500 dark:text-slate-400">Active rides</p></div>
        <div className="card"><Star className="mb-2 h-6 w-6 fill-amber-400 text-amber-400" /><p className="text-2xl font-bold">{user?.ratingAverage?.toFixed(1) || 'New'}</p><p className="text-sm text-slate-500 dark:text-slate-400">Average rating</p></div>
        <Link to="/driver/offer-ride" className="card flex flex-col items-center justify-center bg-gradient-to-br from-brand-600 to-accent-cyan text-white">
          <PlusCircle className="mb-2 h-6 w-6" />
          <p className="font-semibold">Offer a new ride</p>
        </Link>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Your active rides</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">You haven't offered any rides yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((r) => (
              <li key={r._id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm">
                <span>{r.origin.label} → {r.destination.label}</span>
                <span className="text-slate-400">{r.seatsAvailable}/{r.totalSeats} seats</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
