import { useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Users, Car, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

const ROLE_BADGES = [
  { icon: Users, label: 'Passenger' },
  { icon: Car, label: 'Driver' },
  { icon: ShieldCheck, label: 'Admin' }
];

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);

  const goToDashboard = useCallback(
    (user) => {
      const dest = location.state?.from?.pathname || (user.role === 'admin' ? '/admin' : user.role === 'driver' ? '/driver' : '/passenger');
      navigate(dest, { replace: true });
    },
    [location, navigate]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        const user = await login(form);
        goToDashboard(user);
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Login failed. Check your email and password and try again.');
      } finally {
        setLoading(false);
      }
    },
    [form, login, goToDashboard]
  );

  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      setError('');
      try {
        const { user, passwordRemoved } = await loginWithGoogle(credentialResponse.credential);
        if (passwordRemoved) {
          setGoogleUser(user); // let the person read the notice before continuing
          return;
        }
        goToDashboard(user);
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Google sign-in failed');
      }
    },
    [loginWithGoogle, goToDashboard]
  );

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-5xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-2">
      {/* Left: one-login pitch */}
      <div className="hidden flex-col gap-6 lg:flex">
        <h1 className="text-3xl font-extrabold leading-tight">
          One login for
          <span className="bg-gradient-to-r from-brand-600 to-accent-cyan bg-clip-text text-transparent"> everyone</span>
        </h1>
        <p className="max-w-md text-slate-500 dark:text-slate-400">
          Passengers, drivers and admins all sign in from this single screen — the app takes you to the right
          dashboard automatically based on your account's role.
        </p>
        <div className="flex flex-wrap gap-3">
          {ROLE_BADGES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-3.5 py-2 text-sm font-medium"
            >
              <Icon className="h-4 w-4 text-brand-600" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Right: form */}
      <div className="mx-auto w-full max-w-md">
        <div className="card">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <LogIn className="h-5 w-5 text-brand-600" /> {t('auth.welcomeBack')}
          </h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t('auth.loginSubtitle')}</p>

          {error && <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-600">{error}</div>}

          {googleUser && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="font-semibold">Google is now linked to this account.</p>
              <p className="mt-1">
                An account with this email already existed but its email had never been verified, so for your safety its old password was removed.
                From now on sign in with Google.
              </p>
              <button type="button" onClick={() => goToDashboard(googleUser)} className="btn-primary mt-3 !py-2 text-sm">Continue</button>
            </div>
          )}

          {GOOGLE_ENABLED && (
            <div className="mb-4 flex flex-col items-center gap-3">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed')} width="320" />
              <div className="flex w-full items-center gap-3 text-xs uppercase text-slate-400">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                {t('auth.orContinueWith')}
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          )}

          {!GOOGLE_ENABLED && import.meta.env.DEV && (
            <p className="mb-4 rounded-lg border border-dashed border-slate-300 p-2 text-xs text-slate-500 dark:border-slate-700">
              Dev note: “Continue with Google” is hidden because <code>VITE_GOOGLE_CLIENT_ID</code> is not set in <code>frontend/.env</code> (see README → Google OAuth).
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('auth.email')}</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@college.edu"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('auth.password')}</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary mt-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  {t('auth.loggingIn')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" /> {t('auth.logIn')}
                </span>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('auth.newHere')}{' '}
            <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>

        {/* Interactive 1-Click Quick Demo Switcher */}
        <div className="card mt-5 border border-brand-500/20 bg-gradient-to-b from-brand-500/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
              ⚡ 1-Click Instant Demo Login
            </span>
            <span className="text-[11px] text-slate-400">Click to sign in instantly</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Passenger', name: 'Meera', email: 'meera.passenger@carpoolconnect.app', icon: '🎒', roleClass: 'border-sky-500/30 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/30' },
              { label: 'Driver', name: 'Asha', email: 'asha.driver@carpoolconnect.app', icon: '🚗', roleClass: 'border-purple-500/30 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/30' },
              { label: 'Admin', name: 'Deepa', email: 'admin@carpoolconnect.app', icon: '👑', roleClass: 'border-amber-500/30 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/30' }
            ].map((p) => (
              <button
                key={p.email}
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  try {
                    const u = await login({ email: p.email, password: 'Carpool@123' });
                    goToDashboard(u);
                  } catch (err) {
                    setError(typeof err === 'string' ? err : 'Quick login failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border bg-white/70 dark:bg-slate-900/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md text-center group cursor-pointer ${p.roleClass}`}
              >
                <span className="text-xl mb-0.5 group-hover:scale-110 transition-transform">{p.icon}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
