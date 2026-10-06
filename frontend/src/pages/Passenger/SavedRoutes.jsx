import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPinned, Plus, Trash2 } from 'lucide-react';
import { savedRouteService } from '../../services/savedRouteService';
import { useRides } from '../../hooks/useRides';
import EmptyState from '../../components/common/EmptyState';
import Loader from '../../components/common/Loader';

export default function SavedRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: '', origin: '', destination: '' });
  const { searchRides } = useRides();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await savedRouteService.getMine();
    setRoutes(data.routes);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.label || !form.origin || !form.destination) return;
    await savedRouteService.create(form);
    setForm({ label: '', origin: '', destination: '' });
    load();
  };

  const handleDelete = async (id) => {
    await savedRouteService.remove(id);
    load();
  };

  const quickSearch = async (route) => {
    await searchRides({ origin: route.origin, destination: route.destination });
    navigate('/passenger/search-results');
  };

  if (loading) return <Loader label="Loading saved routes..." />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Saved Routes</h1>

      <form onSubmit={handleAdd} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Label</label>
          <input className="input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Home to College" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Origin</label>
          <input className="input" value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Destination</label>
          <input className="input" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
        </div>
        <button className="btn-primary"><Plus className="h-4.5 w-4.5" /> Save</button>
      </form>

      {routes.length === 0 ? (
        <EmptyState icon={MapPinned} title="No saved routes" message="Save a route to search it again in one click." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routes.map((r) => (
            <div key={r._id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold">{r.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{r.origin} → {r.destination}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => quickSearch(r)} className="btn-secondary text-sm">Search</button>
                <button onClick={() => handleDelete(r._id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
