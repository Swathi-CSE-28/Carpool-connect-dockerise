const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { bootApp, startFakeGeoServer } = require('./helpers');
const { io: ioClient } = require('socket.io-client');
const { OAuth2Client } = require('google-auth-library');

let app;
let fakeGeo;
let User;
let RefreshToken;

// ---- Google: only the network call to Google is replaced; the real OAuth2Client class and our controller run ----
const GOOGLE = {
  'tok-new-driver': { sub: 'g-1', email: 'newdriver@gmail.test', name: 'New Driver', email_verified: true },
  'tok-new-admin-attempt': { sub: 'g-2', email: 'sneaky@gmail.test', name: 'Sneaky', email_verified: true },
  'tok-unverified': { sub: 'g-3', email: 'unverified@gmail.test', name: 'U', email_verified: false },
  'tok-link-verified-local': { sub: 'g-4', email: 'verifiedlocal@test.app', name: 'VL', email_verified: true },
  'tok-link-unverified-local': { sub: 'g-5', email: 'victim@test.app', name: 'Victim', email_verified: true },
  'tok-existing-driver-as-passenger': { sub: 'g-6', email: 'existingdriver@test.app', name: 'ED', email_verified: true }
};
OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => {
  if (!GOOGLE[idToken]) throw new Error('Wrong recipient / invalid token');
  return { getPayload: () => GOOGLE[idToken] };
};

// ---- tiny cookie-aware client ----
function client() {
  const jar = {};
  const call = async (method, path, { token, body, origin } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (origin) headers.Origin = origin;
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${app.base}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const raw = res.headers.getSetCookie?.() || [];
    for (const c of raw) {
      const [pair] = c.split(';');
      const [k, ...v] = pair.split('=');
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) delete jar[k];
      else jar[k] = v.join('=');
    }
    let json = {};
    try { json = await res.json(); } catch (e) { /* no body */ }
    return { status: res.status, body: json, setCookie: raw };
  };
  return { call, jar };
}

const connectSocket = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(app.base, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => { s.close(); resolve(true); });
    s.on('connect_error', () => { s.close(); reject(new Error('refused')); });
  });

before(async () => {
  fakeGeo = await startFakeGeoServer();
  app = await bootApp(fakeGeo.url, { db: 'cc_test_auth' });
  User = require('../src/models/User');
  RefreshToken = require('../src/models/RefreshToken');
});

after(async () => {
  await app.close();
  await new Promise((r) => fakeGeo.server.close(r));
});

const creds = (email) => ({ name: 'Test User', email, password: 'Carpool@123' });

test('register/login issue a short-lived JWT access token + an httpOnly refresh cookie', async () => {
  const c = client();
  const reg = await c.call('POST', '/auth/register', { body: { ...creds('a@test.app'), role: 'driver' } });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.password, undefined);
  assert.equal(reg.body.user.tokenVersion, undefined, 'internal fields are never sent to the client');

  const decoded = jwt.decode(reg.body.token);
  assert.equal(decoded.iss, 'carpool-connect');
  assert.equal(decoded.aud, 'carpool-connect-web');
  assert.equal(decoded.role, 'driver');
  assert.ok(decoded.exp - decoded.iat <= 15 * 60, 'access token lives at most 15 minutes');

  const cookie = reg.setCookie.find((x) => x.startsWith('cc_refresh='));
  assert.ok(cookie, 'refresh cookie set');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api\/auth/);

  const stored = await RefreshToken.findOne({});
  assert.notEqual(stored.tokenHash, c.jar.cc_refresh, 'only a hash of the refresh token is stored');

  const login = await c.call('POST', '/auth/login', { body: { email: 'a@test.app', password: 'Carpool@123' } });
  assert.equal(login.status, 200);
  assert.equal((await c.call('POST', '/auth/login', { body: { email: 'a@test.app', password: 'wrong-password' } })).status, 401);
  assert.equal((await c.call('GET', '/auth/me', { token: login.body.token })).body.user.email, 'a@test.app');
});

test('the API rejects forged, wrong-audience, wrong-algorithm and tampered tokens', async () => {
  const c = client();
  const reg = await c.call('POST', '/auth/register', { body: creds('b@test.app') });
  const id = reg.body.user._id;
  const secret = process.env.JWT_SECRET;

  const noIssuer = jwt.sign({ id, role: 'admin', tv: 0 }, secret, { expiresIn: '5m' }); // right secret, but not minted by us
  const wrongAud = jwt.sign({ id, role: 'passenger', tv: 0 }, secret, { issuer: 'carpool-connect', audience: 'somebody-else', expiresIn: '5m' });
  const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id, role: 'admin', tv: 0, iss: 'carpool-connect', aud: 'carpool-connect-web' })).toString('base64url')}.`;
  const hs512 = jwt.sign({ id, role: 'passenger', tv: 0 }, secret, { algorithm: 'HS512', issuer: 'carpool-connect', audience: 'carpool-connect-web', expiresIn: '5m' });
  const expired = jwt.sign({ id, role: 'passenger', tv: 0 }, secret, { issuer: 'carpool-connect', audience: 'carpool-connect-web', expiresIn: -10 });
  const tampered = `${reg.body.token.slice(0, -4)}AAAA`;

  for (const [name, t] of Object.entries({ noIssuer, wrongAud, noneAlg, hs512, expired, tampered })) {
    assert.equal((await c.call('GET', '/auth/me', { token: t })).status, 401, `${name} must be rejected`);
  }
  assert.equal((await c.call('GET', '/auth/me')).status, 401);
  assert.equal((await c.call('GET', '/auth/me', { token: reg.body.token })).status, 200);

  // a role claim in the token can't be forged to escalate: the role used by the API/sockets comes from the database
  const forgedRole = jwt.sign({ id, role: 'admin', tv: 0 }, secret, { issuer: 'carpool-connect', audience: 'carpool-connect-web', expiresIn: '5m' });
  assert.equal((await c.call('GET', '/admin/users', { token: forgedRole })).status, 403);
});

test('refresh rotates the cookie; replaying an old refresh token kills the whole session', async () => {
  const c = client();
  await c.call('POST', '/auth/register', { body: creds('c@test.app') });
  const first = c.jar.cc_refresh;

  const r1 = await c.call('POST', '/auth/refresh');
  assert.equal(r1.status, 200);
  assert.ok(r1.body.token);
  assert.notEqual(c.jar.cc_refresh, first, 'refresh token rotated');
  const second = c.jar.cc_refresh;
  assert.equal((await c.call('GET', '/auth/me', { token: r1.body.token })).status, 200);

  // an attacker replays the first (already used) token
  const attacker = client();
  attacker.jar.cc_refresh = first;
  assert.equal((await attacker.call('POST', '/auth/refresh')).status, 401);

  // ...and now the legitimate holder's newer token is dead too (family revoked)
  c.jar.cc_refresh = second;
  assert.equal((await c.call('POST', '/auth/refresh')).status, 401);
});

test('refresh without a cookie fails; refresh from a foreign origin is refused', async () => {
  const c = client();
  assert.equal((await c.call('POST', '/auth/refresh')).status, 401);
  await c.call('POST', '/auth/register', { body: creds('d@test.app') });
  assert.equal((await c.call('POST', '/auth/refresh', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await c.call('POST', '/auth/refresh', { origin: 'http://localhost:5173' })).status, 200);
});

test('logout ends the session: the refresh token stops working and the cookie is cleared', async () => {
  const c = client();
  await c.call('POST', '/auth/register', { body: creds('e@test.app') });
  const saved = c.jar.cc_refresh;
  const out = await c.call('POST', '/auth/logout');
  assert.equal(out.status, 200);
  assert.equal(c.jar.cc_refresh, undefined, 'cookie cleared');

  const replay = client();
  replay.jar.cc_refresh = saved;
  assert.equal((await replay.call('POST', '/auth/refresh')).status, 401);
  assert.equal((await client().call('POST', '/auth/logout')).status, 200, 'logout is idempotent');
});

test('logout-all revokes every device: refresh tokens, outstanding access tokens and sockets', async () => {
  const phone = client();
  const laptop = client();
  const reg = await phone.call('POST', '/auth/register', { body: creds('f@test.app') });
  const lap = await laptop.call('POST', '/auth/login', { body: { email: 'f@test.app', password: 'Carpool@123' } });

  assert.equal(await connectSocket(reg.body.token), true);
  assert.equal((await phone.call('POST', '/auth/logout-all', { token: reg.body.token })).status, 200);

  assert.equal((await laptop.call('GET', '/auth/me', { token: lap.body.token })).status, 401, 'old access token is dead immediately');
  assert.equal((await laptop.call('POST', '/auth/refresh')).status, 401, 'other device cannot refresh');
  await assert.rejects(connectSocket(reg.body.token), 'sockets refuse tokens from ended sessions');

  const again = await laptop.call('POST', '/auth/login', { body: { email: 'f@test.app', password: 'Carpool@123' } });
  assert.equal((await laptop.call('GET', '/auth/me', { token: again.body.token })).status, 200, 'signing in again works');
  assert.equal(await connectSocket(again.body.token), true);
});

test('a deactivated account can no longer refresh or connect', async () => {
  const c = client();
  const reg = await c.call('POST', '/auth/register', { body: creds('g@test.app') });
  await User.updateOne({ email: 'g@test.app' }, { isActive: false });
  assert.equal((await c.call('POST', '/auth/refresh')).status, 401);
  assert.equal((await c.call('GET', '/auth/me', { token: reg.body.token })).status, 401);
  await assert.rejects(connectSocket(reg.body.token));
});

test('Google OAuth: reports clearly when the server is not configured', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  assert.equal((await client().call('POST', '/auth/google', { body: { credential: 'tok-new-driver' } })).status, 501);
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

test('Google OAuth: new users choose passenger or driver (never admin) and get a normal session', async () => {
  const c = client();
  const res = await c.call('POST', '/auth/google', { body: { credential: 'tok-new-driver', role: 'driver', gender: 'female' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.created, true);
  assert.equal(res.body.user.role, 'driver');
  assert.equal(res.body.user.gender, 'female');
  assert.equal(res.body.user.authProvider, 'google');
  assert.equal(res.body.user.isVerified, true);
  assert.ok(c.jar.cc_refresh, 'Google sign-in also gets a refresh cookie');
  assert.equal((await c.call('GET', '/auth/me', { token: res.body.token })).status, 200);
  assert.equal((await c.call('POST', '/auth/refresh')).status, 200);

  const sneaky = await client().call('POST', '/auth/google', { body: { credential: 'tok-new-admin-attempt', role: 'admin' } });
  assert.equal(sneaky.body.user.role, 'passenger', 'admin cannot be self-assigned through OAuth');

  const again = await client().call('POST', '/auth/google', { body: { credential: 'tok-new-driver', role: 'passenger' } });
  assert.equal(again.body.created, false);
  assert.equal(again.body.user._id, res.body.user._id, 'same Google account -> same user');
  assert.equal(again.body.user.role, 'driver', 'role is never changed by signing in again');
  assert.equal(await User.countDocuments({ googleId: 'g-1' }), 1);
});

test('Google OAuth: invalid tokens and unverified Google emails are rejected', async () => {
  assert.equal((await client().call('POST', '/auth/google', { body: { credential: 'garbage' } })).status, 401);
  const unverified = await client().call('POST', '/auth/google', { body: { credential: 'tok-unverified' } });
  assert.equal(unverified.status, 401);
  assert.match(unverified.body.message, /not verified/i);
  assert.equal(await User.countDocuments({ email: 'unverified@gmail.test' }), 0);
  assert.equal((await client().call('POST', '/auth/google', { body: {} })).status, 400);
});

test('Google OAuth: an existing role is never changed by OAuth sign-in', async () => {
  await User.create({ name: 'ED', email: 'existingdriver@test.app', password: 'Carpool@123', role: 'driver', isVerified: true });
  const res = await client().call('POST', '/auth/google', { body: { credential: 'tok-existing-driver-as-passenger', role: 'passenger' } });
  assert.equal(res.body.user.role, 'driver');
});

test('Google OAuth: linking a VERIFIED password account keeps the password', async () => {
  await User.create({ name: 'VL', email: 'verifiedlocal@test.app', password: 'Carpool@123', isVerified: true });
  const res = await client().call('POST', '/auth/google', { body: { credential: 'tok-link-verified-local' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.passwordRemoved, false);
  assert.equal((await client().call('POST', '/auth/login', { body: { email: 'verifiedlocal@test.app', password: 'Carpool@123' } })).status, 200);
});

test('Google OAuth: pre-registration takeover is blocked (unverified password account loses its password)', async () => {
  // attacker registers the victim's email address with a password they know, and is logged in
  const attacker = client();
  const reg = await attacker.call('POST', '/auth/register', { body: { name: 'Mallory', email: 'victim@test.app', password: 'AttackerKnows1' } });
  assert.equal(reg.status, 201);

  // the real owner later signs in with Google
  const victim = client();
  const res = await victim.call('POST', '/auth/google', { body: { credential: 'tok-link-unverified-local' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.passwordRemoved, true);
  assert.equal(res.body.user._id, reg.body.user._id);

  // the attacker is locked out everywhere
  assert.equal((await attacker.call('POST', '/auth/login', { body: { email: 'victim@test.app', password: 'AttackerKnows1' } })).status, 401, 'password no longer works');
  assert.equal((await attacker.call('GET', '/auth/me', { token: reg.body.token })).status, 401, "attacker's existing access token is revoked");
  const stale = client();
  stale.jar.cc_refresh = 'whatever';
  assert.equal((await stale.call('POST', '/auth/refresh')).status, 401);
  assert.equal((await victim.call('GET', '/auth/me', { token: res.body.token })).status, 200, 'the real owner is fine');
});

test('JWT_SECRET startup check: weak/missing secrets are refused in production, tolerated in development', () => {
  const { assertJwtSecret } = require('../src/config/auth');
  const saved = { s: process.env.JWT_SECRET, e: process.env.NODE_ENV };
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'replace_this_with_a_long_random_secret';
    assert.throws(assertJwtSecret, /too weak/);
    process.env.JWT_SECRET = 'short';
    assert.throws(assertJwtSecret, /too weak/);
    delete process.env.JWT_SECRET;
    assert.throws(assertJwtSecret, /not set/);
    process.env.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
    assert.doesNotThrow(assertJwtSecret);
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'short';
    assert.doesNotThrow(assertJwtSecret);
  } finally {
    process.env.JWT_SECRET = saved.s;
    process.env.NODE_ENV = saved.e;
  }
});
