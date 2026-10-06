import api from './api';

export const reportService = {
  create: (data) => api.post('/reports', data).then((r) => r.data),
  getMine: () => api.get('/reports/my').then((r) => r.data)
};
