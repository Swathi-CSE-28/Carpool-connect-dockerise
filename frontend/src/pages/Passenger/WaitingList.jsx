import { useEffect, useState, useCallback } from 'react';
import { Bookmark } from 'lucide-react';
import { waitlistService } from '../../services/waitlistService';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';

export default function WaitingList() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await waitlistService.getMine();
    setEntries(data.entries);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLeave = async (id) => {
    await waitlistService.leave(id);
    load();
  };

  if (loading) return <Loader label="Loading your waiting list..." />;

  if (entries.length === 0) {
    return <EmptyState icon={Bookmark} title="You're not on any waiting lists" message="Join one from a full ride's details page." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Waiting List</h1>
      {entries.map((e) => (
        <div key={e._id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{e.ride?.origin?.label} → {e.ride?.destination?.label}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Position #{e.position} · {e.ride?.driver?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={e.status === 'promoted' ? 'green' : 'yellow'}>{e.status}</Badge>
            {e.status === 'waiting' && (
              <button onClick={() => handleLeave(e._id)} className="text-sm font-medium text-rose-600 hover:underline">
                Leave list
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
