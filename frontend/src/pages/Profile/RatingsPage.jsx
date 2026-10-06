import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { reviewService } from '../../services/reviewService';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

function StarRow({ value, size = 'h-4 w-4' }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`} />
      ))}
    </div>
  );
}

export default function RatingsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    if (!user?._id) return;
    reviewService.getForUser(user._id).then((data) => setReviews(data.reviews));
  }, [user?._id]);

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: (reviews || []).filter((r) => Math.round(r.rating) === star).length
  }));
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link to="/profile" className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <div>
        <h1 className="section-title text-2xl">
          <Star className="h-6 w-6 fill-amber-400 text-amber-400" /> Ratings &amp; Reviews
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">What other riders and drivers have said about you.</p>
      </div>

      <div className="card flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center gap-1 sm:border-r sm:border-slate-200 sm:dark:border-slate-800 sm:pr-6">
          <span className="text-4xl font-bold">{user?.ratingAverage?.toFixed(1) || '—'}</span>
          <StarRow value={user?.ratingAverage || 0} size="h-5 w-5" />
          <span className="text-xs text-slate-400">{user?.ratingCount || 0} reviews</span>
        </div>
        <div className="flex-1 space-y-1.5">
          {breakdown.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-3 shrink-0 text-slate-400">{star}</span>
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="w-5 shrink-0 text-right text-slate-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {!reviews ? (
        <Loader label="Loading reviews..." />
      ) : reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" message="Complete a ride to start collecting ratings from other riders and drivers." />
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div key={review._id} className="card flex gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: review.reviewer?.avatarColor || '#7c3aed' }}
              >
                {review.reviewer?.name?.[0]?.toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="font-semibold">{review.reviewer?.name || 'A rider'}</p>
                  <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <StarRow value={review.rating} />
                {review.comment && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
