import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import EmptyState from '../common/EmptyState';

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Bell className="h-4.5 w-4.5" /> Notifications {unreadCount > 0 && `(${unreadCount})`}
        </h3>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" message="Booking updates, waitlist openings and trip alerts will show up here." />
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n._id}
              onClick={() => !n.isRead && markRead(n._id)}
              className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                n.isRead
                  ? 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  : 'border-brand-300 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700 font-medium'
              }`}
            >
              <p>{n.title}</p>
              <p className="text-xs opacity-80">{n.message}</p>
              <p className="mt-1 text-[11px] opacity-60">{new Date(n.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
