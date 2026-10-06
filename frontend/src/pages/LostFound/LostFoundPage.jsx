import { useState, useCallback, useEffect } from 'react';
import { PackageSearch, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLostItems } from '../../hooks/useLostItems';
import { rideService } from '../../services/rideService';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';

const STATUS_VARIANT = { open: 'yellow', claimed: 'blue', returned: 'green', closed: 'slate' };

export default function LostFoundPage() {
  const { user } = useAuth();
  const { items, fetchForRide, reportItem, claimItem } = useLostItems();
  const [myRides, setMyRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState('');
  const [form, setForm] = useState({ itemDescription: '', foundLocation: '' });
  const [claimMsg, setClaimMsg] = useState('');

  useEffect(() => {
    if (user?.role === 'driver') {
      rideService.getMine().then((data) => {
        setMyRides(data.rides);
        if (data.rides.length) setSelectedRide(data.rides[0]._id);
      });
    }
  }, [user]);

  useEffect(() => {
    if (selectedRide) fetchForRide(selectedRide);
  }, [selectedRide, fetchForRide]);

  const handleReport = async (e) => {
    e.preventDefault();
    await reportItem({ rideId: selectedRide, ...form });
    setForm({ itemDescription: '', foundLocation: '' });
    fetchForRide(selectedRide);
  };

  const handleClaim = async (id) => {
    await claimItem(id, claimMsg);
    setClaimMsg('');
    fetchForRide(selectedRide);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><PackageSearch className="h-6 w-6" /> Lost & Found</h1>

      {user?.role === 'driver' && (
        <div className="card">
          <label className="mb-1 block text-sm font-medium">Select ride</label>
          <select className="input mb-4" value={selectedRide} onChange={(e) => setSelectedRide(e.target.value)}>
            {myRides.map((r) => (
              <option key={r._id} value={r._id}>{r.origin.label} → {r.destination.label}</option>
            ))}
          </select>

          <form onSubmit={handleReport} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Item description</label>
              <input className="input" required value={form.itemDescription} onChange={(e) => setForm((f) => ({ ...f, itemDescription: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Where it was found</label>
              <input className="input" required value={form.foundLocation} onChange={(e) => setForm((f) => ({ ...f, foundLocation: e.target.value }))} />
            </div>
            <button className="btn-primary"><Plus className="h-4.5 w-4.5" /> Report</button>
          </form>
          <p className="mt-2 text-xs text-slate-400">Only passengers with an accepted booking on this ride will be notified.</p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No lost-item reports" message={user?.role === 'driver' ? 'Reports you create for a ride will show up here.' : 'Reports for rides you participated in will show up here.'} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item._id} className="card">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{item.itemDescription}</p>
                <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Found at: {item.foundLocation}</p>
              {user?.role === 'passenger' && item.status === 'open' && (
                <div className="mt-3 flex gap-2">
                  <input className="input" placeholder="Optional message" value={claimMsg} onChange={(e) => setClaimMsg(e.target.value)} />
                  <button onClick={() => handleClaim(item._id)} className="btn-primary shrink-0">This is mine</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
