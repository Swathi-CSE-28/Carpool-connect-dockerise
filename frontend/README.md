# CarPool Connect — Frontend

React 18 + Vite single-page app.

## Setup

```bash
cp .env.example .env   # point VITE_API_URL at your backend
npm install
npm run dev              # http://localhost:5173
npm run build             # production build to dist/
```

## Structure

```
src/
├── context/       AuthContext, ThemeContext, NotificationContext, RideContext (useReducer)
├── hooks/           useAuth, useRides, useBookings, useNotifications, useLostItems,
│                   useRideSearch, useDebounce, useLocalStorage, useLiveTrip, useTheme
├── services/       one Axios-based module per API resource
├── components/    common/ navigation/ rides/ notifications/ (reusable UI)
├── layouts/         PublicLayout (marketing pages), DashboardLayout (sidebar + navbar)
├── pages/            Home, Auth, Passenger, Driver, Admin, Notifications, LostFound, Safety, Profile
└── App.jsx          all routing + role-based route protection
```

Role-based route protection is handled by `components/common/ProtectedRoute.jsx`,
which checks both authentication and (optionally) `allowedRoles` against the
logged-in user before rendering a route.
