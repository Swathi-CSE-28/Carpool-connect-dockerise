import { useRideSearch } from '../../hooks/useRideSearch';
import RideCard from '../../components/rides/RideCard';
import EmptyState from '../../components/common/EmptyState';
import Loader from '../../components/common/Loader';
import { SearchX, Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SearchResults() {
  const { results, alternatives, hasExactResults, loading } = useRideSearch();

  if (loading) return <Loader label="Searching for rides..." />;

  if (results.length === 0 && alternatives.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No rides found"
        message="Try a nearby pickup point, a wider date range, or join the waiting list once you find a close match."
        action={<Link to="/passenger/find-ride" className="btn-secondary mt-2">Adjust search</Link>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hasExactResults && (
        <div>
          <h2 className="mb-3 font-semibold">Exact matches ({results.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((ride) => <RideCard key={ride._id} ride={ride} />)}
          </div>
        </div>
      )}

      {!hasExactResults && alternatives.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Bookmark className="h-4.5 w-4.5 text-sky-600" />
            <h2 className="font-semibold">No exact match — here are close alternatives</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map(({ ride, ...matchInfo }) => (
              <RideCard key={ride._id} ride={ride} matchInfo={matchInfo} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
