import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { rideService } from '../../services/rideService';

export default function RecentlyViewed() {
  const { t } = useTranslation();
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    rideService
      .getRecentlyViewed()
      .then((data) => setRecent(data.recent))
      .catch(() => setRecent([]));
  }, []);

  if (!recent || recent.length === 0) return null;

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <History className="h-4.5 w-4.5 text-brand-600" /> {t('recentlyViewed.title')}
      </h2>
      <ul className="flex flex-col gap-2">
        {recent.map(({ ride, viewedAt }) => (
          <li key={ride._id}>
            <Link
              to={`/rides/${ride._id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm transition hover:border-brand-300 dark:hover:border-brand-700"
            >
              <span className="flex items-center gap-2 truncate">
                <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
                <span className="truncate">
                  {ride.origin?.label} <span className="text-slate-400">→</span> {ride.destination?.label}
                </span>
              </span>
              <span className="shrink-0 pl-3 text-xs text-slate-400">{new Date(viewedAt).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
