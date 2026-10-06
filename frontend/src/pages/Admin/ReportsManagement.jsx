import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';

const STATUS_VARIANT = { open: 'yellow', under_review: 'blue', resolved: 'green', dismissed: 'slate' };

export default function ReportsManagement() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminService.getReports();
    setReports(data.reports);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    await adminService.updateReportStatus(id, { status });
    load();
  };

  if (loading) return <Loader label="Loading reports..." />;

  if (reports.length === 0) {
    return <EmptyState icon={AlertTriangle} title="No safety reports" message="Reports submitted by users will appear here for review." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><AlertTriangle className="h-6 w-6" /> Safety Reports</h1>
      {reports.map((r) => (
        <div key={r._id} className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold capitalize">{r.category.replace(/_/g, ' ')}</p>
            <Badge variant={STATUS_VARIANT[r.status]}>{r.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{r.description}</p>
          <p className="mb-3 text-xs text-slate-400">Reported by {r.reportedBy?.name} {r.reportedUser ? `about ${r.reportedUser.name}` : ''}</p>
          <div className="flex gap-2">
            {['under_review', 'resolved', 'dismissed'].map((s) => (
              <button key={s} onClick={() => updateStatus(r._id, s)} className="btn-secondary text-xs capitalize">{s.replace(/_/g, ' ')}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
