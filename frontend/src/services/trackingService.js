import api from './api';

export const trackingService = {
  getSnapshot: (rideId) => api.get(`/tracking/rides/${rideId}`).then((r) => r.data),
  getEta: (rideId) => api.get(`/tracking/rides/${rideId}/eta`).then((r) => r.data.eta),
  start: (rideId) => api.post(`/tracking/rides/${rideId}/start`).then((r) => r.data),
  pause: (rideId) => api.post(`/tracking/rides/${rideId}/pause`).then((r) => r.data),
  resume: (rideId) => api.post(`/tracking/rides/${rideId}/resume`).then((r) => r.data),
  setProgress: (rideId, step) => api.post(`/tracking/rides/${rideId}/status`, { step }).then((r) => r.data),
  end: (rideId) => api.post(`/tracking/rides/${rideId}/end`).then((r) => r.data),
  // HTTP fallback used only while the socket is down
  sendLocation: (rideId, payload) => api.post(`/tracking/rides/${rideId}/location`, payload, {
    validateStatus: (s) => s === 200 || s === 202
  }).then((r) => r.data),
  getEmergencyContacts: () => api.get('/tracking/emergency-contacts').then((r) => r.data.contacts)
};

export const geoService = {
  search: (q) => api.get('/geo/search', { params: { q } }).then((r) => r.data.results)
};
