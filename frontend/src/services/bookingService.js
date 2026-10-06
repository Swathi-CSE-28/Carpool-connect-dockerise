import api from './api';

export const bookingService = {
  create: (data) => api.post('/bookings', data).then((r) => r.data),
  getMine: () => api.get('/bookings/my').then((r) => r.data),
  getForRide: (rideId) => api.get(`/bookings/ride/${rideId}`).then((r) => r.data),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }).then((r) => r.data),
  cancel: (id) => api.delete(`/bookings/${id}`).then((r) => r.data)
};
