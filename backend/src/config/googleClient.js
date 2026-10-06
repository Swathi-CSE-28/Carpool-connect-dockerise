const { OAuth2Client } = require('google-auth-library');

// Lazily created so the server can boot even if OAuth env vars aren't set yet
// (Google Sign-In simply returns a clear 501 until GOOGLE_CLIENT_ID is configured).
let client = null;

const getGoogleClient = () => {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  if (!client) client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return client;
};

module.exports = { getGoogleClient };
