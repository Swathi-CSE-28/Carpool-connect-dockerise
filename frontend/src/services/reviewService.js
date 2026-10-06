import api from './api';

export const reviewService = {
  create: (data) => api.post('/reviews', data).then((r) => r.data),
  getForUser: (userId) => api.get(`/reviews/user/${userId}`).then((r) => r.data)
};
