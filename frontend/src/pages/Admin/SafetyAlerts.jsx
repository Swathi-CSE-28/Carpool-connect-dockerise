import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, MapPin, CheckCircle2, Radio } from 'lucide-react';
import { sosService } from '../../services/sosService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

const STATUS_STYLES = {
  active: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  acknowledged: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
};

export default function SafetyAlerts() {
  const [alerts, setAlerts] = useState(null);
  const [live, setLive] = useState(false);

  const load = useCallback(() => {
    sosService.active().then((data) => setAlerts(data.alerts)).catch(() => setAlerts([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: any admin online gets new SOS alerts pushed instantly via Socket.IO,
  // instead of waiting for a page refresh or a polling interval.
  useEffect(() => {
    const socket = connectSocket();

    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onNew = (alert) => setAlerts((prev) => [alert, ...(prev || [])]);
    const onUpdate = (alert) =>
      setAlerts((prev) => (prev || []).map((a) => (a._id === alert._id ? alert : a)).filter((a) => a.status !== 'resolved' || a._id === alert._id));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('sos:new', onNew);
    socket.on('sos:update', onUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('sos:new', onNew);
      socket.off('sos:update', onUpdate);
      disconnectSocket();
    };
  }, []);

  const acknowledge = async (id) => {
    const data = await sosService.acknowledge(id);
    setAlerts((prev) => prev.map((a) => (a._id === id ? data.alert : a)));
  };

  const resolve = async (id) => {
    const data = await sosService.resolve(id);
    setAlerts((prev) => prev.filter((a) => a._id !== id).concat([])); // remove from active queue
    void data;
  };

  if (!alerts) return <Loader label="Loading safety alerts..." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert className="h-6 w-6 text-rose-600" /> Safety Alerts (SOS)
        </h1>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${live ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          <Radio className="h-3.5 w-3.5" /> {live ? 'Live' : 'Connecting...'}
        </span>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No active alerts"
          message="Every SOS trigger from a rider or driver will appear here instantly, in real time."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <div key={alert._id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: alert.user?.avatarColor || '#e11d48' }}
                >
                  {alert.user?.name?.[0]?.toUpperCase() || '!'}
                </span>
                <div>
                  <p className="font-semibold">
                    {alert.user?.name} <span className="text-xs font-normal text-slate-400">({alert.user?.role})</span>
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{alert.message}</p>
                  {(alert.location?.lat || alert.location?.label) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {alert.location?.lat
                        ? `${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}`
                        : alert.location?.label}
                    </p>
                  )}
                  {alert.ride?.origin && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Ride: {alert.ride.origin.label} → {alert.ride.destination.label}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`badge ${STATUS_STYLES[alert.status]}`}>{alert.status}</span>
                {alert.status === 'active' && (
                  <button onClick={() => acknowledge(alert._id)} className="btn-secondary !px-3 !py-1.5 text-xs">
                    Acknowledge
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button onClick={() => resolve(alert._id)} className="btn-primary !px-3 !py-1.5 text-xs">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
