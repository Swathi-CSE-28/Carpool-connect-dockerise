import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  // role/gender are only used when this Google account is new (passenger or driver; admin is impossible)
  googleLogin: (credential, extras = {}) => api.post('/auth/google', { credential, ...extras }).then((r) => r.data),
  getMe: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  logoutAll: () => api.post('/auth/logout-all').then((r) => r.data),
  updateProfile: (data) => api.patch('/users/profile', data).then((r) => r.data),
  generateApiKey: () => api.post('/auth/api-key').then((r) => r.data)
};
