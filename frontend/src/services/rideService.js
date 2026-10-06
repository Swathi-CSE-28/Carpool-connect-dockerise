import api from './api';

export const rideService = {
  search: (params) => api.get('/rides', { params }).then((r) => r.data),
  getAlternatives: (params) => api.get('/rides/alternatives', { params }).then((r) => r.data),
  getWomenOnly: () => api.get('/rides/women-only').then((r) => r.data),
  getRecentlyViewed: () => api.get('/rides/recent').then((r) => r.data),
  getById: (id) => api.get(`/rides/${id}`).then((r) => r.data),
  create: (data) => api.post('/rides', data).then((r) => r.data),
  update: (id, data) => api.patch(`/rides/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/rides/${id}`).then((r) => r.data),
  getMine: () => api.get('/rides/driver/mine').then((r) => r.data)
};
