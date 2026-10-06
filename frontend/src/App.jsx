import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import ChatbotWidget from './components/chatbot/ChatbotWidget';
import SOSButton from './components/safety/SOSButton';
import { useAuth } from './hooks/useAuth';

import Landing from './pages/Home/Landing';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import SafetyInfo from './pages/Safety/SafetyInfo';

import PassengerDashboard from './pages/Passenger/Dashboard';
import FindRide from './pages/Passenger/FindRide';
import SearchResults from './pages/Passenger/SearchResults';
import RideDetails from './pages/Passenger/RideDetails';
import MyBookings from './pages/Passenger/MyBookings';
import TrackRide from './pages/Passenger/TrackRide';
import WaitingList from './pages/Passenger/WaitingList';
import SavedRoutes from './pages/Passenger/SavedRoutes';
import WomenOnlyRides from './pages/Passenger/WomenOnlyRides';
import EcoImpact from './pages/Passenger/EcoImpact';

import DriverDashboard from './pages/Driver/Dashboard';
import OfferRide from './pages/Driver/OfferRide';
import MyRides from './pages/Driver/MyRides';
import DriveRide from './pages/Driver/DriveRide';
import PassengerRequests from './pages/Driver/PassengerRequests';

import NotificationsPage from './pages/Notifications/NotificationsPage';
import LostFoundPage from './pages/LostFound/LostFoundPage';
import ProfilePage from './pages/Profile/ProfilePage';
import RatingsPage from './pages/Profile/RatingsPage';
import SettingsPage from './pages/Settings/SettingsPage';

import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import RideManagement from './pages/Admin/RideManagement';
import ReportsManagement from './pages/Admin/ReportsManagement';
import SafetyAlerts from './pages/Admin/SafetyAlerts';

export default function App() {
  const { isAuthenticated, user } = useAuth();

  return (
    <>
    <div className="app-appearance-scope">
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/safety" element={<SafetyInfo />} />
      </Route>

      {/* Shared authenticated pages (any role) */}
      <Route element={<DashboardLayout />}>
        <Route path="/rides/:id" element={<ProtectedRoute><RideDetails /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/lost-found" element={<ProtectedRoute><LostFoundPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/ratings" element={<ProtectedRoute><RatingsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

        {/* Passenger */}
        <Route path="/passenger" element={<ProtectedRoute allowedRoles={['passenger']}><PassengerDashboard /></ProtectedRoute>} />
        <Route path="/passenger/find-ride" element={<ProtectedRoute allowedRoles={['passenger']}><FindRide /></ProtectedRoute>} />
        <Route path="/passenger/search-results" element={<ProtectedRoute allowedRoles={['passenger']}><SearchResults /></ProtectedRoute>} />
        <Route path="/passenger/bookings" element={<ProtectedRoute allowedRoles={['passenger']}><MyBookings /></ProtectedRoute>} />
        <Route path="/passenger/track/:rideId" element={<ProtectedRoute allowedRoles={['passenger']}><TrackRide /></ProtectedRoute>} />
        <Route path="/passenger/waitlist" element={<ProtectedRoute allowedRoles={['passenger']}><WaitingList /></ProtectedRoute>} />
        <Route path="/passenger/saved-routes" element={<ProtectedRoute allowedRoles={['passenger']}><SavedRoutes /></ProtectedRoute>} />
        <Route path="/passenger/women-only" element={<ProtectedRoute allowedRoles={['passenger']}><WomenOnlyRides /></ProtectedRoute>} />
        <Route path="/passenger/eco-impact" element={<ProtectedRoute allowedRoles={['passenger']}><EcoImpact /></ProtectedRoute>} />

        {/* Driver */}
        <Route path="/driver" element={<ProtectedRoute allowedRoles={['driver']}><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/offer-ride" element={<ProtectedRoute allowedRoles={['driver']}><OfferRide /></ProtectedRoute>} />
        <Route path="/driver/my-rides" element={<ProtectedRoute allowedRoles={['driver']}><MyRides /></ProtectedRoute>} />
        <Route path="/driver/ride/:rideId" element={<ProtectedRoute allowedRoles={['driver']}><DriveRide /></ProtectedRoute>} />
        <Route path="/driver/requests" element={<ProtectedRoute allowedRoles={['driver']}><PassengerRequests /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/rides" element={<ProtectedRoute allowedRoles={['admin']}><RideManagement /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><ReportsManagement /></ProtectedRoute>} />
        <Route path="/admin/safety" element={<ProtectedRoute allowedRoles={['admin']}><SafetyAlerts /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>

    <ChatbotWidget />
    {isAuthenticated && user?.role !== 'admin' && <SOSButton />}
    </>
  );
}
