import { useState, useCallback } from 'react';
import { bookingService } from '../services/bookingService';

export function useBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMyBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingService.getMine();
      setBookings(data.bookings);
      return data.bookings;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bookRide = useCallback(async (rideId, pickupPointId, seatsRequested = 1) => {
    return bookingService.create({ rideId, pickupPointId, seatsRequested });
  }, []);

  const cancelBooking = useCallback(async (id) => {
    const result = await bookingService.cancel(id);
    setBookings((prev) => prev.map((b) => (b._id === id ? { ...b, status: 'cancelled' } : b)));
    return result;
  }, []);

  return { bookings, loading, error, fetchMyBookings, bookRide, cancelBooking };
}
