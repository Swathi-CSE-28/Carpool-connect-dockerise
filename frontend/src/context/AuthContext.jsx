import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';
import { refreshAccessToken } from '../services/api';

export const AuthContext = createContext(null);

const store = (data) => {
  localStorage.setItem('cc_token', data.token);
  localStorage.setItem('cc_user', JSON.stringify(data.user));
};
const clearStore = () => {
  localStorage.removeItem('cc_token');
  localStorage.removeItem('cc_user');
};

// Reads the `exp` claim (seconds) of a JWT without verifying it - only used to schedule a refresh.
function tokenExpiryMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000;
  } catch (e) {
    return 0;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('cc_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [tokenTick, setTokenTick] = useState(0); // bumps whenever a new access token is stored

  // Restore the session on load. An expired access token is renewed transparently from the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!localStorage.getItem('cc_token') && !localStorage.getItem('cc_user')) {
        setLoading(false);
        return;
      }
      try {
        if (!localStorage.getItem('cc_token')) await refreshAccessToken();
        const data = await authService.getMe();
        if (cancelled) return;
        setUser(data.user);
        localStorage.setItem('cc_user', JSON.stringify(data.user));
      } catch (err) {
        if (cancelled) return;
        clearStore();
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // React to session changes made by the API layer (silent refresh / refresh failure).
  useEffect(() => {
    const onRefreshed = (e) => { setUser(e.detail); setTokenTick((n) => n + 1); };
    const onExpired = () => setUser(null);
    window.addEventListener('cc:token-refreshed', onRefreshed);
    window.addEventListener('cc:session-expired', onExpired);
    return () => {
      window.removeEventListener('cc:token-refreshed', onRefreshed);
      window.removeEventListener('cc:session-expired', onExpired);
    };
  }, []);

  // Refresh shortly before the access token expires so open pages (e.g. live tracking) never hit a 401.
  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem('cc_token');
    const exp = token ? tokenExpiryMs(token) : 0;
    if (!exp) return undefined;
    const delay = Math.max(exp - Date.now() - 60 * 1000, 5000);
    const id = setTimeout(() => { refreshAccessToken().catch(() => {}); }, delay);
    return () => clearTimeout(id);
  }, [user, tokenTick]);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    store(data);
    setUser(data.user);
    setTokenTick((n) => n + 1);
    return data.user;
  }, []);

  // Returns { user, created, passwordRemoved } so the UI can explain what happened.
  const loginWithGoogle = useCallback(async (credential, extras) => {
    const data = await authService.googleLogin(credential, extras);
    store(data);
    setUser(data.user);
    setTokenTick((n) => n + 1);
    return { user: data.user, created: !!data.created, passwordRemoved: !!data.passwordRemoved };
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    store(data);
    setUser(data.user);
    setTokenTick((n) => n + 1);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    clearStore(); // sign out locally first: the UI never waits on the network
    setUser(null);
    try { await authService.logout(); } catch (e) { /* the refresh cookie simply expires on its own */ }
  }, []);

  const logoutAll = useCallback(async () => {
    await authService.logoutAll();
    clearStore();
    setUser(null);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('cc_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, register, logout, logoutAll, updateUser, isAuthenticated: !!user }),
    [user, loading, login, loginWithGoogle, register, logout, logoutAll, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
