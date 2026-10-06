import { createContext, useReducer, useCallback, useMemo } from 'react';
import { rideService } from '../services/rideService';

export const RideContext = createContext(null);

const initialState = {
  results: [],
  alternatives: [],
  lastSearch: null,
  loading: false,
  error: null
};

function rideReducer(state, action) {
  switch (action.type) {
    case 'SEARCH_START':
      return { ...state, loading: true, error: null };
    case 'SEARCH_SUCCESS':
      return { ...state, loading: false, results: action.payload.rides, lastSearch: action.payload.params };
    case 'ALTERNATIVES_SUCCESS':
      return { ...state, alternatives: action.payload };
    case 'SEARCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

export function RideProvider({ children }) {
  const [state, dispatch] = useReducer(rideReducer, initialState);

  const searchRides = useCallback(async (params) => {
    dispatch({ type: 'SEARCH_START' });
    try {
      const data = await rideService.search(params);
      dispatch({ type: 'SEARCH_SUCCESS', payload: { rides: data.rides, params } });

      // If nothing (or very little) matched exactly, proactively look for alternatives
      if (data.rides.length === 0 && params.origin && params.destination) {
        const alt = await rideService.getAlternatives(params);
        dispatch({ type: 'ALTERNATIVES_SUCCESS', payload: alt.alternatives });
      } else {
        dispatch({ type: 'ALTERNATIVES_SUCCESS', payload: [] });
      }
      return data.rides;
    } catch (err) {
      dispatch({ type: 'SEARCH_ERROR', payload: err });
      throw err;
    }
  }, []);

  const clearResults = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const value = useMemo(() => ({ ...state, searchRides, clearResults }), [state, searchRides, clearResults]);

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}
