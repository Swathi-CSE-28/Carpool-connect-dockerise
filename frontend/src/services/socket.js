import { io } from 'socket.io-client';
import { refreshAccessToken } from './api';

let socket = null;
const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Lazily creates a single shared authenticated socket connection.
// Used by the admin dashboard to receive live SOS alerts.
export function getSocket() {
  if (socket) return socket;

  socket = io(socketUrl, {
    autoConnect: false,
    auth: { token: localStorage.getItem('cc_token') }
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: localStorage.getItem('cc_token') };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

/**
 * A dedicated socket for one live-tracking page. It is created when the page
 * opens and fully disconnected when the page closes (no lingering connection or
 * listeners), and it auto-reconnects with backoff if the network drops.
 * The token is read through a function so a reconnect always uses the latest one.
 */
export function createTrackingSocket() {
  const socket = io(socketUrl, {
    auth: (cb) => cb({ token: localStorage.getItem('cc_token') }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 8000
  });
  // If the server rejects an expired access token, renew it; the next automatic retry uses the new one.
  socket.on('connect_error', (err) => {
    if (err?.message === 'Invalid token') refreshAccessToken().catch(() => {});
  });
  return socket;
}
