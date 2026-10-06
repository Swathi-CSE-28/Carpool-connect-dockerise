import { Link, useNavigate } from 'react-router-dom';
import { Car, Moon, Sun, Bell, LogOut, Menu, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useNotifications } from '../../hooks/useNotifications';
import LanguageSwitcher from '../common/LanguageSwitcher';

export default function Navbar({ onMenuClick }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'driver' ? '/driver' : '/passenger';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-[#07090e]/75 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          {isAuthenticated && (
            <button onClick={onMenuClick} className="md:hidden rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Link to={isAuthenticated ? dashboardPath : '/'} className="flex items-center gap-2.5 group">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-cyan text-white shadow-glow-sm transition-transform duration-300 group-hover:scale-105">
              <Car className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-cyan"></span>
              </span>
            </span>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-600 via-indigo-500 to-accent-cyan bg-clip-text text-transparent">
                CarPool Connect
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 -mt-1 hidden sm:block">
                Campus Ride Sharing
              </span>
            </div>
          </Link>

          {!isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 pl-4">
              <Link to="/#features" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition">
                Features
              </Link>
              <Link to="/#how-it-works" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition">
                How It Works
              </Link>
              <Link to="/#eco-calculator" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition">
                Eco Calculator
              </Link>
              <Link to="/safety" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition">
                Safety
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-brand-600" />}
          </button>

          {isAuthenticated ? (
            <>
              <Link
                to="/notifications"
                className="relative rounded-xl p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute 1 top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/profile" className="hidden sm:flex items-center gap-2 rounded-xl p-1.5 pr-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-2 ring-brand-500/20"
                  style={{ backgroundColor: user?.avatarColor || '#7c3aed' }}
                >
                  {user?.name?.[0]?.toUpperCase()}
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight">{user?.name?.split(' ')[0]}</span>
                  <span className="text-[10px] uppercase font-semibold text-brand-600 dark:text-brand-400 leading-none">
                    {user?.role}
                  </span>
                </div>
              </Link>
              <Link
                to="/settings"
                className="rounded-xl p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label={t('nav.settings')}
                title={t('nav.settings')}
              >
                <SettingsIcon className="h-5 w-5" />
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="rounded-xl p-2.5 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition"
                aria-label="Log out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary !py-2 !px-4 text-sm">{t('nav.login')}</Link>
              <Link to="/register" className="btn-primary !py-2 !px-4 text-sm">{t('nav.signup')}</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
