import { useState, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sosService } from '../../services/sosService';

export default function SOSButton() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { ok: boolean, text: string }

  const handleConfirm = useCallback(async () => {
    setSending(true);
    setStatus(null);

    const send = (coords) =>
      sosService
        .trigger({
          lat: coords?.lat,
          lng: coords?.lng,
          label: coords ? undefined : 'Location unavailable (permission denied)'
        })
        .then(() => setStatus({ ok: true, text: t('sos.sent') }))
        .catch(() => setStatus({ ok: false, text: t('sos.failed') }))
        .finally(() => {
          setSending(false);
          setConfirming(false);
        });

    if (!navigator.geolocation) {
      send(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => send({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => send(null),
      { timeout: 5000 }
    );
  }, [t]);

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2">
      {status && (
        <div
          className={`max-w-xs rounded-xl px-3 py-2 text-xs font-medium shadow-card ${
            status.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {status.text}
        </div>
      )}

      {confirming && (
        <div className="w-72 rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-4 shadow-card">
          <p className="mb-1 text-sm font-semibold text-rose-600">{t('sos.confirmTitle')}</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('sos.confirmBody')}</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="btn-secondary flex-1 !py-2 text-xs">
              {t('sos.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="btn-primary flex-1 !py-2 !bg-none !bg-rose-600 text-xs"
            >
              {sending ? '...' : t('sos.confirm')}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setConfirming((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-card animate-pulse hover:opacity-90"
        aria-label={t('sos.button')}
        title={t('sos.button')}
      >
        <ShieldAlert className="h-6 w-6" />
      </button>
    </div>
  );
}
