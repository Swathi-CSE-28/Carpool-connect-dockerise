import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Star, Save, KeyRound, Copy, Check, ChevronRight, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';

export default function ProfilePage() {
  const { user, updateUser, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    vehicle: { make: '', model: '', color: '', plateNumber: '', ...(user?.vehicle || {}) },
    preferences: user?.preferences || { music: true, smoking: false, pets: false, luggage: true, conversation: 'no_preference' }
  });
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateApiKey = useCallback(async () => {
    setGenerating(true);
    try {
      const data = await authService.generateApiKey();
      setApiKey(data.apiKey);
      setCopied(false);
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleCopyApiKey = useCallback(() => {
    navigator.clipboard?.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [apiKey]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const data = await authService.updateProfile(form);
      updateUser(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [form, updateUser]
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Hero header */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-600/10 via-accent-cyan/10 to-transparent" />
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl font-semibold text-white shadow-card"
            style={{ backgroundColor: user?.avatarColor || '#7c3aed' }}
          >
            {user?.name?.[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{user?.name}</h1>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 capitalize">{user?.role}</span>
              {user?.isVerified && (
                <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
          </div>
        </div>

        <Link
          to="/profile/ratings"
          className="card-hover mt-5 flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-3.5"
        >
          <span className="flex items-center gap-2 text-sm">
            <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{user?.ratingAverage?.toFixed(1) || 'New'}</span>
            <span className="text-slate-400">
              ({user?.ratingCount || 0} reviews) · {user?.completedRides || 0} completed rides
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
            View ratings &amp; reviews <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <h2 className="section-title text-base">Edit profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        {user?.role === 'driver' && (
          <div>
            <label className="mb-1 block text-sm font-medium">Vehicle (shown to passengers with a confirmed booking)</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['make', 'Make'], ['model', 'Model'], ['color', 'Colour'], ['plateNumber', 'Plate no.']].map(([k, label]) => (
                <input key={k} className="input" placeholder={label} aria-label={label} value={form.vehicle[k] || ''}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, [k]: e.target.value } }))} />
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">Ride preferences</label>
          <div className="flex flex-wrap gap-4">
            {['music', 'smoking', 'pets', 'luggage'].map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={form.preferences[key]}
                  onChange={(e) => setForm((f) => ({ ...f, preferences: { ...f.preferences, [key]: e.target.checked } }))}
                />
                {key}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Conversation style</label>
          <select
            className="input"
            value={form.preferences.conversation}
            onChange={(e) => setForm((f) => ({ ...f, preferences: { ...f.preferences, conversation: e.target.value } }))}
          >
            <option value="no_preference">No preference</option>
            <option value="chatty">Chatty</option>
            <option value="quiet">Quiet</option>
          </select>
        </div>

        <button type="submit" className="btn-primary self-start"><Save className="h-4.5 w-4.5" /> {saved ? 'Saved!' : 'Save changes'}</button>
      </form>

      <Link to="/settings" className="card-hover card flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <SettingsIcon className="h-4.5 w-4.5 text-brand-600" /> Appearance, language &amp; more
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </Link>

      <div className="card flex flex-col gap-3">
        <h2 className="section-title text-base"><LogOut className="h-4.5 w-4.5 text-brand-600" /> Sessions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Lost a phone or used a shared computer? This signs you out on every device immediately, including live-tracking connections.
        </p>
        <button
          disabled={signingOut}
          className="btn-secondary self-start"
          onClick={async () => {
            if (!window.confirm('Sign out of all devices?')) return;
            setSigningOut(true);
            try { await logoutAll(); navigate('/login'); } finally { setSigningOut(false); }
          }}
        >
          {signingOut ? 'Signing out…' : 'Sign out of all devices'}
        </button>
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="section-title text-base"><KeyRound className="h-4.5 w-4.5 text-brand-600" /> Developer API access</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Generate a personal key to call the read-only integration API (<code>GET /api/public/rides</code>, <code>GET /api/public/stats</code>)
          from an external app, using the <code>x-api-key</code> header. See <code>/api-docs</code> for the full spec.
        </p>
        <button onClick={handleGenerateApiKey} disabled={generating} className="btn-secondary self-start">
          {generating ? 'Generating...' : apiKey ? 'Regenerate key' : 'Generate API key'}
        </button>
        {apiKey && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{apiKey}</code>
            <button onClick={handleCopyApiKey} className="shrink-0 text-slate-500 hover:text-brand-600" aria-label="Copy API key">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
