import { useState, useCallback } from 'react';
import { lostItemService } from '../services/lostItemService';

export function useLostItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchForRide = useCallback(async (rideId) => {
    setLoading(true);
    try {
      const data = await lostItemService.getForRide(rideId);
      setItems(data.items);
      return data.items;
    } finally {
      setLoading(false);
    }
  }, []);

  const reportItem = useCallback(async (payload) => lostItemService.create(payload), []);
  const claimItem = useCallback(async (id, message) => lostItemService.claim(id, message), []);

  return { items, loading, fetchForRide, reportItem, claimItem };
}
