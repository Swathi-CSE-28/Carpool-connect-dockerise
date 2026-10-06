import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ListChecks, Bookmark, Leaf } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { bookingService } from '../../services/bookingService';
import RecentlyViewed from '../../components/rides/RecentlyViewed';

export default function PassengerDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    bookingService.getMine().then((data) => setBookings(data.bookings)).catch(() => {});
  }, []);

  const upcoming = bookings.filter((b) => b.status === 'accepted').slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Here's what's happening with your rides.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/passenger/find-ride', icon: Search, label: 'Find a Ride', color: 'from-brand-600 to-accent-cyan' },
          { to: '/passenger/bookings', icon: ListChecks, label: 'My Bookings', color: 'from-emerald-500 to-teal-500' },
          { to: '/passenger/waitlist', icon: Bookmark, label: 'Waiting List', color: 'from-amber-500 to-orange-500' },
          { to: '/passenger/eco-impact', icon: Leaf, label: 'Eco Impact', color: 'from-green-500 to-lime-500' }
        ].map(({ to, icon: Icon, label, color }) => (
          <Link key={to} to={to} className="card group transition hover:-translate-y-0.5">
            <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="font-semibold">{label}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Upcoming rides</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No upcoming rides yet. <Link to="/passenger/find-ride" className="text-brand-600 hover:underline">Find one now</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <li key={b._id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm">
                <span>{b.ride?.origin?.label} → {b.ride?.destination?.label}</span>
                <span className="text-slate-400">{new Date(b.ride?.departureTime).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecentlyViewed />
    </div>
  );
}
