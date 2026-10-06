import api from './api';

export const waitlistService = {
  join: (rideId) => api.post('/waitlist', { rideId }).then((r) => r.data),
  getMine: () => api.get('/waitlist/my').then((r) => r.data),
  leave: (id) => api.delete(`/waitlist/${id}`).then((r) => r.data)
};
