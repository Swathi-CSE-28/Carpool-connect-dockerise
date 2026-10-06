import api from './api';

export const ecoService = {
  getMine: () => api.get('/eco/my').then((r) => r.data)
};
