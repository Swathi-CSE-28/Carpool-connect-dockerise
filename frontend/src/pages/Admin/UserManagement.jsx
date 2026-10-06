import { useEffect, useState, useCallback } from 'react';
import { Users, Ban, CheckCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminService.getUsers(q ? { q } : {});
    setUsers(data.users);
    setLoading(false);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    await adminService.updateUserStatus(u._id, !u.isActive);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="h-6 w-6" /> User Management</h1>
      <input className="input max-w-sm" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />

      {loading ? <Loader label="Loading users..." /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3"><Badge variant={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge></td>
                  <td className="p-3">
                    {u.role !== 'admin' && (
                      <button onClick={() => toggleActive(u)} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                        {u.isActive ? <><Ban className="h-3.5 w-3.5" /> Deactivate</> : <><CheckCircle className="h-3.5 w-3.5" /> Activate</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
