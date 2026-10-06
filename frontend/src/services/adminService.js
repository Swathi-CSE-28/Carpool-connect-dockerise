import api from './api';

export const adminService = {
  getStats: () => api.get('/admin/stats').then((r) => r.data),
  getUsers: (params) => api.get('/admin/users', { params }).then((r) => r.data),
  updateUserStatus: (id, isActive) => api.patch(`/admin/users/${id}/status`, { isActive }).then((r) => r.data),
  getRides: () => api.get('/admin/rides').then((r) => r.data),
  getReports: (params) => api.get('/admin/reports', { params }).then((r) => r.data),
  updateReportStatus: (id, data) => api.patch(`/admin/reports/${id}`, data).then((r) => r.data),
  getLostItems: () => api.get('/admin/lost-items').then((r) => r.data)
};
