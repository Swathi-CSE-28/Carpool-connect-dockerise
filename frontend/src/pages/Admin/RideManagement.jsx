import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';
import { adminService } from '../../services/adminService';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';

export default function RideManagement() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getRides().then((data) => setRides(data.rides)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading rides..." />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Car className="h-6 w-6" /> Ride Management</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
            <tr><th className="p-3">Route</th><th className="p-3">Driver</th><th className="p-3">Departure</th><th className="p-3">Seats</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r._id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="p-3">{r.origin.label} → {r.destination.label}</td>
                <td className="p-3">{r.driver?.name}</td>
                <td className="p-3">{new Date(r.departureTime).toLocaleString()}</td>
                <td className="p-3">{r.seatsAvailable}/{r.totalSeats}</td>
                <td className="p-3"><Badge variant={r.status === 'cancelled' ? 'red' : r.status === 'completed' ? 'green' : 'blue'}>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
