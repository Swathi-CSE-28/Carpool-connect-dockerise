import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Sun, Moon, Palette, Type, SunMedium, Languages, RotateCcw, Check } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { changeLanguage } from '../../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' }
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const {
    theme, toggleTheme,
    bgTheme, setBgTheme, backgroundThemes,
    fontFamily, setFontFamily, fontFamilies,
    fontSize, setFontSize, fontSizes,
    brightness, setBrightness
  } = useTheme();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="section-title text-2xl">
          <SettingsIcon className="h-6 w-6 text-brand-600" /> {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('settings.subtitle')}</p>
      </div>

      {/* Language */}
      <section className="card flex flex-col gap-4">
        <h2 className="section-title text-base">
          <Languages className="h-4.5 w-4.5 text-brand-600" /> {t('settings.language')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.languageDesc')}</p>
        <div className="flex flex-wrap gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex w-36 flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${
                i18n.language === lang.code
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-brand-300'
              }`}
            >
              <span className="flex w-full items-center justify-between text-sm font-semibold">
                {lang.native}
                {i18n.language === lang.code && <Check className="h-4 w-4 text-brand-600" />}
              </span>
              <span className="text-xs text-slate-400">{lang.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Appearance: mode + dynamic background theme */}
      <section className="card flex flex-col gap-4">
        <h2 className="section-title text-base">
          <Palette className="h-4.5 w-4.5 text-brand-600" /> {t('settings.appearance')}
        </h2>

        <div>
          <label className="mb-2 block text-sm font-medium">{t('settings.mode')}</label>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1">
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                theme === 'light' ? 'bg-brand-600 text-white' : 'text-slate-500'
              }`}
            >
              <Sun className="h-4 w-4" /> {t('settings.light')}
            </button>
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                theme === 'dark' ? 'bg-brand-600 text-white' : 'text-slate-500'
              }`}
            >
              <Moon className="h-4 w-4" /> {t('settings.dark')}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t('settings.backgroundTheme')}</label>
          <div className="flex flex-wrap gap-3">
            {Object.entries(backgroundThemes).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setBgTheme(key)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition ${
                  bgTheme === key ? 'ring-2 ring-brand-600' : 'ring-1 ring-slate-200 dark:ring-slate-800'
                }`}
                title={val.label}
              >
                <span className="h-10 w-14 rounded-lg" style={{ background: val.swatch }} />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{val.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Font size and style */}
      <section className="card flex flex-col gap-4">
        <h2 className="section-title text-base">
          <Type className="h-4.5 w-4.5 text-brand-600" /> {t('settings.fontFamily')} &amp; {t('settings.fontSize')}
        </h2>

        <div>
          <label className="mb-2 block text-sm font-medium">{t('settings.fontFamily')}</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(fontFamilies).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFontFamily(key)}
                style={{ fontFamily: val.stack }}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition ${
                  fontFamily === key ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-brand-300'
                }`}
              >
                <span className="text-xl">{val.preview}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{val.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t('settings.fontSize')}</label>
          <div className="inline-flex flex-wrap gap-2">
            {Object.entries(fontSizes).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFontSize(key)}
                className={`rounded-xl border-2 px-3.5 py-2 text-sm font-medium transition ${
                  fontSize === key ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-800 hover:border-brand-300'
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Brightness */}
      <section className="card flex flex-col gap-3">
        <h2 className="section-title text-base">
          <SunMedium className="h-4.5 w-4.5 text-brand-600" /> {t('settings.brightness')}
        </h2>
        <div className="flex items-center gap-4">
          <Sun className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="range"
            min="70"
            max="130"
            step="5"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="slider"
          />
          <SunMedium className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums">{brightness}%</span>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{t('settings.saved')}</p>
        <button
          onClick={() => {
            setBgTheme('default');
            setFontFamily('inter');
            setFontSize('md');
            setBrightness(100);
          }}
          className="btn-secondary !px-3 !py-2 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t('settings.reset')}
        </button>
      </div>
    </div>
  );
}
