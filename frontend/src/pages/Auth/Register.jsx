import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../hooks/useAuth';

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'passenger', gender: 'prefer_not_to_say' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        const user = await register(form);
        navigate(user.role === 'driver' ? '/driver' : '/passenger', { replace: true });
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Registration failed');
      } finally {
        setLoading(false);
      }
    },
    [form, register, navigate]
  );

  // The role/gender chosen below are sent with the Google token and used only if this Google account is new.
  const handleGoogle = useCallback(
    async (credentialResponse) => {
      setError('');
      try {
        const { user } = await loginWithGoogle(credentialResponse.credential, { role: form.role, gender: form.gender });
        navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/passenger', { replace: true });
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Google sign-up failed');
      }
    },
    [form.role, form.gender, loginWithGoogle, navigate]
  );

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card">
        <h1 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <UserPlus className="h-5 w-5 text-brand-600" /> Create your account
        </h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Join as a passenger or a driver.</p>

        {error && <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-600">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Full name</label>
            <input required className="input" value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input type="email" required className="input" value={form.email} onChange={update('email')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input type="password" required minLength={6} className="input" value={form.password} onChange={update('password')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">I am a</label>
              <select className="input" value={form.role} onChange={update('role')}>
                <option value="passenger">Passenger</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Gender</label>
              <select className="input" value={form.gender} onChange={update('gender')}>
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Gender is only used to enable the optional Women-Only ride preference and is never shown publicly on ride cards.
          </p>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {!GOOGLE_ENABLED && import.meta.env.DEV && (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-2 text-xs text-slate-500 dark:border-slate-700">
            Dev note: Google sign-up is hidden because <code>VITE_GOOGLE_CLIENT_ID</code> is not set in <code>frontend/.env</code> (see README → Google OAuth).
          </p>
        )}

        {GOOGLE_ENABLED && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="flex w-full items-center gap-3 text-xs uppercase text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /> or sign up with Google <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
            <GoogleLogin onSuccess={handleGoogle} onError={() => setError('Google sign-up failed')} width="320" text="signup_with" />
            <p className="text-center text-xs text-slate-400">Uses the “I am a” and Gender choices above for a new account.</p>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
