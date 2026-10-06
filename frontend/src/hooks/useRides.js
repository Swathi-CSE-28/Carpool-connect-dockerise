import { useContext } from 'react';
import { RideContext } from '../context/RideContext';

export function useRides() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRides must be used within a RideProvider');
  return ctx;
}
