import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true // sends/receives the httpOnly refresh cookie
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// Silent token refresh. Access tokens are short-lived (15 min); the long-lived
// refresh token lives in an httpOnly cookie that JavaScript can't read. One
// refresh request is shared by all calls that hit 401 at the same time.
// ---------------------------------------------------------------------------
let refreshPromise = null;

export function refreshAccessToken() {
  if (!refreshPromise) {
    // plain axios (not `api`) so this call can never trigger the 401 interceptor below
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        localStorage.setItem('cc_token', res.data.token);
        localStorage.setItem('cc_user', JSON.stringify(res.data.user));
        window.dispatchEvent(new CustomEvent('cc:token-refreshed', { detail: res.data.user }));
        return res.data.token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh', '/auth/logout'];

function endSession() {
  localStorage.removeItem('cc_token');
  localStorage.removeItem('cc_user');
  window.dispatchEvent(new Event('cc:session-expired'));
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthCall = AUTH_PATHS.some((p) => original?.url?.includes(p));

    if (err.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original); // replay the request that failed
      } catch (refreshErr) {
        endSession();
      }
    }
    return Promise.reject(err.response?.data?.message || err.message || 'Something went wrong');
  }
);

export default api;
