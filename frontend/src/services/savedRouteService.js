import api from './api';

export const savedRouteService = {
  getMine: () => api.get('/saved-routes/my').then((r) => r.data),
  create: (data) => api.post('/saved-routes', data).then((r) => r.data),
  update: (id, data) => api.patch(`/saved-routes/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/saved-routes/${id}`).then((r) => r.data)
};
