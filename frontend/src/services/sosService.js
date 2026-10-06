import api from './api';

export const sosService = {
  trigger: (data) => api.post('/sos', data).then((r) => r.data),
  mine: () => api.get('/sos/mine').then((r) => r.data),
  active: () => api.get('/sos').then((r) => r.data),
  acknowledge: (id) => api.patch(`/sos/${id}/acknowledge`).then((r) => r.data),
  resolve: (id, resolutionNotes) => api.patch(`/sos/${id}/resolve`, { resolutionNotes }).then((r) => r.data)
};
