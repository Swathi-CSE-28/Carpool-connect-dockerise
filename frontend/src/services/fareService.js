import api from './api';

export const fareService = {
  // Server-side road-route quote: distance, duration, route line and fare (also per pickup stop)
  quote: (payload) => api.post('/fare/quote', payload).then((r) => r.data)
};
