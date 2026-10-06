import { useCallback } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRideSearch } from '../../hooks/useRideSearch';

export default function FindRide() {
  const { filters, updateFilter, runSearch, loading } = useRideSearch();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      await runSearch();
      navigate('/passenger/search-results');
    },
    [runSearch, navigate]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Find a ride</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Search exact routes, or we'll suggest close alternatives if nothing matches.
      </p>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Pickup location</label>
          <input className="input" required value={filters.origin} onChange={(e) => updateFilter('origin', e.target.value)} placeholder="e.g. Kovilpatti Bus Stand" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Destination</label>
          <input className="input" required value={filters.destination} onChange={(e) => updateFilter('destination', e.target.value)} placeholder="e.g. National Engineering College" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input type="date" className="input" value={filters.date} onChange={(e) => updateFilter('date', e.target.value)} />
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filters.womenOnly} onChange={(e) => updateFilter('womenOnly', e.target.checked)} />
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Women-only rides
            </label>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          <Search className="h-4.5 w-4.5" /> {loading ? 'Searching...' : 'Search rides'}
        </button>
      </form>
    </div>
  );
}
