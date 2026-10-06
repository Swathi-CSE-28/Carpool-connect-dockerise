import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Car, AlertTriangle, PackageSearch, Activity, ListChecks, ShieldAlert, BookOpen } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { sosService } from '../../services/sosService';
import Loader from '../../components/common/Loader';

const API_DOCS_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')}/api-docs`;

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState(null);

  useEffect(() => {
    adminService.getStats().then((data) => setStats(data.stats));
    sosService.active().then((data) => setActiveAlerts(data.alerts)).catch(() => setActiveAlerts([]));
  }, []);

  if (!stats) return <Loader label="Loading dashboard stats..." />;

  const cards = [
    { icon: Users, label: 'Total users', value: stats.totalUsers },
    { icon: Users, label: 'Drivers / Passengers', value: `${stats.totalDrivers} / ${stats.totalPassengers}` },
    { icon: Car, label: 'Total rides', value: stats.totalRides },
    { icon: Activity, label: 'Active rides', value: stats.activeRides },
    { icon: ListChecks, label: 'Total bookings', value: stats.totalBookings },
    { icon: AlertTriangle, label: 'Open safety reports', value: stats.openReports },
    { icon: PackageSearch, label: 'Open lost items', value: stats.openLostItems }
  ];

  const activeCount = activeAlerts?.filter((a) => a.status === 'active').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <a href={API_DOCS_URL} target="_blank" rel="noreferrer" className="btn-secondary !px-3 !py-2 text-xs">
          <BookOpen className="h-4 w-4" /> API Docs
        </a>
      </div>

      {activeCount > 0 && (
        <Link
          to="/admin/safety"
          className="card flex items-center justify-between border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20"
        >
          <span className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <span>
              <span className="block font-semibold text-rose-700 dark:text-rose-300">
                {activeCount} active SOS alert{activeCount > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-rose-600/80 dark:text-rose-300/70">Tap to view and respond in real time</span>
            </span>
          </span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card">
            <Icon className="mb-2 h-6 w-6 text-brand-600" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
