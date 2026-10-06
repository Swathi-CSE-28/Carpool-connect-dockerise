import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Search, Bookmark, ListChecks, MapPinned, Leaf, User,
  Car, PlusCircle, Users, PackageSearch, Bell, ShieldCheck, BarChart3, X, ShieldAlert,
  Star, Settings as SettingsIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

const NAV = {
  passenger: [
    { to: '/passenger', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/passenger/find-ride', labelKey: 'nav.findRide', icon: Search },
    { to: '/passenger/bookings', labelKey: 'nav.myBookings', icon: ListChecks },
    { to: '/passenger/waitlist', labelKey: 'nav.waitlist', icon: Bookmark },
    { to: '/passenger/saved-routes', labelKey: 'nav.savedRoutes', icon: MapPinned },
    { to: '/passenger/women-only', labelKey: 'nav.womenOnly', icon: ShieldCheck },
    { to: '/passenger/eco-impact', labelKey: 'nav.ecoImpact', icon: Leaf },
    { to: '/lost-found', labelKey: 'nav.lostFound', icon: PackageSearch },
    { to: '/notifications', labelKey: 'nav.notifications', icon: Bell }
  ],
  driver: [
    { to: '/driver', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/driver/offer-ride', labelKey: 'nav.offerRide', icon: PlusCircle },
    { to: '/driver/my-rides', labelKey: 'nav.myRides', icon: Car },
    { to: '/driver/requests', labelKey: 'nav.requests', icon: Users },
    { to: '/lost-found', labelKey: 'nav.lostFound', icon: PackageSearch },
    { to: '/notifications', labelKey: 'nav.notifications', icon: Bell }
  ],
  admin: [
    { to: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', labelKey: 'nav.userManagement', icon: Users },
    { to: '/admin/rides', labelKey: 'nav.rideManagement', icon: Car },
    { to: '/admin/reports', labelKey: 'nav.reports', icon: BarChart3 },
    { to: '/admin/safety', labelKey: 'nav.safetyAlerts', icon: ShieldAlert }
  ]
};

// Shown for every role, under a divider at the bottom of the sidebar
const ACCOUNT_NAV = [
  { to: '/profile', labelKey: 'nav.profile', icon: User },
  { to: '/profile/ratings', labelKey: 'nav.ratings', icon: Star },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon }
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const items = NAV[user?.role] || [];

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed z-40 h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 transition-transform md:sticky md:top-16 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-2 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold uppercase text-slate-400">Menu</span>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-card'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {t(labelKey)}
            </NavLink>
          ))}

          <div className="my-2 border-t border-slate-200 dark:border-slate-800" />

          {ACCOUNT_NAV.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-card'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
