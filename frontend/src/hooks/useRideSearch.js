import { useState, useCallback, useMemo } from 'react';
import { useRides } from './useRides';

export function useRideSearch() {
  const { results, alternatives, loading, error, searchRides } = useRides();
  const [filters, setFilters] = useState({ origin: '', destination: '', date: '', womenOnly: false });

  const updateFilter = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const runSearch = useCallback(() => searchRides(filters), [filters, searchRides]);

  const hasExactResults = useMemo(() => results.length > 0, [results]);

  return { filters, updateFilter, runSearch, results, alternatives, hasExactResults, loading, error };
}
