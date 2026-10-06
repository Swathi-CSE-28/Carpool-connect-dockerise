import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { RideProvider } from './context/RideContext.jsx';
import './i18n';
import './styles/index.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// If no Google client id is configured, render children without the OAuth
// provider so the app still runs — the Google button simply won't appear.
function OptionalGoogleProvider({ children }) {
  if (!googleClientId) return children;
  return <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <OptionalGoogleProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <RideProvider>
                <App />
              </RideProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </OptionalGoogleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
