import api from './api';

export const lostItemService = {
  create: (data) => api.post('/lost-items', data).then((r) => r.data),
  getForRide: (rideId) => api.get(`/lost-items/ride/${rideId}`).then((r) => r.data),
  getById: (id) => api.get(`/lost-items/${id}`).then((r) => r.data),
  updateStatus: (id, status) => api.patch(`/lost-items/${id}/status`, { status }).then((r) => r.data),
  claim: (id, message) => api.post(`/lost-items/${id}/claim`, { message }).then((r) => r.data)
};
