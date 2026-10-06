# CarPool Connect — Smart, Safe & Sustainable Ride Sharing Platform

A full-stack MERN-style ride-sharing web app for a college carpool scenario
(built around National Engineering College, Kovilpatti, Tamil Nadu), extended
with OAuth, real-time safety alerts, a support chatbot, multi-language UI, and
a public integration API.

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router + Context API + Framer Motion + Recharts + react-i18next + Lucide icons
- **Backend:** Node.js + Express + MongoDB + Mongoose + JWT + Google OAuth + Socket.IO + Swagger

See `frontend/README.md` and `backend/README.md` for setup instructions specific
to each half, or the sections below for the fastest path to running both.

## Run with Docker

Docker Compose starts the React frontend, Express API, and MongoDB with a
persistent database volume. From this directory, make sure `backend/.env`
exists (copy the example only if you do not already have your own file), and
replace the placeholder `JWT_SECRET` with a long random value:

```bash
# Skip this if backend/.env already exists.
cp backend/.env.example backend/.env
# Edit backend/.env and set a strong JWT_SECRET.
docker compose up --build
```

Open http://localhost:8080. The API is also available at
http://localhost:8080/api/health and its Swagger UI at
http://localhost:8080/api-docs/. MongoDB data persists in the `mongo-data`
volume; `docker compose down -v` removes that data.

To connect MongoDB Compass to the Compose database, use
`mongodb://127.0.0.1:27017/carpool_connect`. The database port is published to
localhost only.

When hosting on another domain, set `CLIENT_URL` in a root `.env` file to the
frontend's public origin (for example, `https://carpool.example.com`). Serve the
frontend through HTTPS in production so secure authentication cookies work.

For Google sign-in, set `VITE_GOOGLE_CLIENT_ID` in a root `.env` file before
building, and set the matching `GOOGLE_CLIENT_ID` in `backend/.env`, then rebuild
the frontend with `docker compose up --build`. `VITE_GOOGLE_CLIENT_ID` is
embedded in the frontend bundle at build time.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env      # edit JWT_SECRET and MONGO_URI; GOOGLE_CLIENT_ID is optional
npm install
npm run seed               # creates 7 real demo accounts + rides + bookings (see below)
npm run dev                # starts on http://localhost:5000

# 2. Frontend (in a second terminal)
cd frontend
cp .env.example .env       # VITE_GOOGLE_CLIENT_ID is optional
npm install
npm run dev                # starts on http://localhost:5173
```

Open http://localhost:5173. API docs are live at http://localhost:5000/api-docs
as soon as the backend is running (no login required to view them).

### Demo accounts (after `npm run seed`, password for all: `Carpool@123`)

| Email                                 | Role      | Notes                                  |
|----------------------------------------|-----------|-----------------------------------------|
| admin@carpoolconnect.app               | admin     | also gets a public-API key on seed      |
| asha.driver@carpoolconnect.app         | driver    | female, verified — offers a Women-Only ride |
| ravi.driver@carpoolconnect.app         | driver    | male, unverified                        |
| karthika.driver@carpoolconnect.app     | driver    | female, verified — offers a Women-Only ride |
| meera.passenger@carpoolconnect.app     | passenger | has an accepted booking                 |
| dinesh.passenger@carpoolconnect.app    | passenger | has a pending booking                   |
| priya.passenger@carpoolconnect.app     | passenger | has an accepted booking                 |

Log in as each to see role-based dashboards; log in as the admin to see every
other account under **Admin → User Management** and the live safety queue
under **Admin → Safety Alerts (SOS)**.

## What's new in this build

1. **OAuth (Google Sign-In)** — `POST /api/auth/google` verifies a Google
   Identity Services ID token server-side (`google-auth-library`) and
   finds-or-creates the user. The "Continue with Google" button on the login
   page only renders if `VITE_GOOGLE_CLIENT_ID` is set, and the backend
   returns a clear `501` instead of crashing if `GOOGLE_CLIENT_ID` is unset —
   see **Enabling Google OAuth** below to turn it on for real.
2. **JWT auth** — unchanged from the base project: email/password login and
   registration issue a signed JWT (`middleware/auth.js` verifies it on every
   protected route); Google sign-in issues the exact same kind of token, so
   the rest of the app doesn't care which way you logged in.
3. **7 real, working accounts** (1 admin / 3 drivers / 3 passengers, table
   above) — exceeds the "5 users" bar, and every one of them has been
   exercised: bookings, a Women-Only ride, an unverified driver, a pending
   vs. accepted booking.
4. **Admin dashboard** — platform stats, user management (activate/deactivate),
   ride oversight, safety-report triage, **plus** a live SOS safety queue and
   a one-click link to the API docs.
5. **API access** — two layers:
   - Interactive Swagger/OpenAPI docs at `/api-docs` documenting every route.
   - A separate **`/api/public/*`** read-only integration API authenticated
     by a long-lived `x-api-key` header instead of a user session (generate
     one from **Profile → Developer API access**, or use the one printed by
     `npm run seed`). Meant to demonstrate how an external site/app (e.g. a
     campus portal widget) could pull live ride data without a full login flow.
6. **Chatbot** — a rule-based support assistant (`/api/chatbot/message`),
   deliberately *not* wired to a paid LLM API: no API key needed, zero
   per-message cost, and it only ever answers with things this app can
   actually back up (real routes, real policies), via keyword-matched intents
   with quick-reply suggestions. Floats bottom-right on every page.
7. **Recently accessed** — every `GET /api/rides/:id` call quietly records the
   ride against the viewing user (capped at the 10 most recent, de-duplicated,
   most-recent-first); shown as a "Recently viewed rides" card on the
   passenger dashboard.
8. **Multi-lingual** — English and Tamil via `react-i18next`, toggled from the
   globe icon in the navbar (persisted in `localStorage`). Covers navigation,
   login, the chatbot, and the SOS flow as a working, end-to-end example
   rather than a token "hello world" toggle.
9. **No sample/dummy data** — the seed script creates internally-consistent,
   real-looking records (valid Indian phone numbers, real Tamil Nadu place
   names, realistic driver/passenger names) instead of "Test User 1" /
   "test@test.com" / Lorem-ipsum descriptions.
10. **Unique feature beyond CRUD: real-time SOS safety alerts.** Any logged-in
    rider or driver has a floating SOS button. Triggering it:
    - creates a persisted `SOSAlert` record (survives refresh/reconnect),
    - **pushes it to every connected admin instantly over Socket.IO**
      (`sockets/index.js` puts every admin socket in an `admins` room; the
      controller emits `sos:new` to that room the moment the alert is
      created — this is genuinely live, not a poll-and-refresh trick),
    - also drops a persistent `Notification` for every admin as a fallback.
    Admins acknowledge/resolve from **Admin → Safety Alerts**, and that
    status change is itself broadcast live (`sos:update`) to every admin
    dashboard open at the time. This sits alongside the base project's other
    non-CRUD piece of logic — the explainable substring/time-window ride
    *matching* engine (`services/matchingService.js`) used for "alternative
    rides" — as the two features to point to in an interview beyond
    "I built forms that hit a database."
11. **CRUD is not the whole app** — on top of #10 and the matching engine:
    password hashing + JWT issuance, gender-gated Women-Only ride creation
    enforced server-side (not just hidden in the UI), waiting-list promotion
    when a seat frees up, and CO₂-savings estimation in the Eco Impact page
    are all logic beyond plain create/read/update/delete.

## UI/UX: Settings, split Profile/Ratings, and the one-screen login

- **Profile and Ratings are now separate pages.** `/profile` is for editing
  your info, ride preferences and generating an API key; `/profile/ratings`
  is a dedicated ratings & reviews page with a star breakdown and the full
  review list. Each links to the other.
- **New Settings page (`/settings`)**, linked from the sidebar (every role),
  the navbar gear icon, and the Profile page:
  - **Multilingual** — English/Tamil, in sync with the navbar's quick language
    switcher (`react-i18next`, persisted in `localStorage`).
  - **Dynamic background theme** — 6 gradient themes (Default, Aurora, Sunset,
    Ocean, Forest, Midnight), each with its own light *and* dark variant,
    applied live to the page background.
  - **Font size** (Small/Medium/Large/Extra large) — scales the root
    `font-size`, which cascades through every rem-based Tailwind class in the
    app.
  - **Font style** — pick between Inter, Poppins, Merriweather and JetBrains
    Mono (loaded on demand from Google Fonts).
  - **Brightness** — a 70–130% slider. Implemented as a CSS filter on a
    `.app-appearance-scope` wrapper around the *routed page content only*
    (see `App.jsx`) — not on `<html>`/`<body>` — so the floating chatbot and
    SOS buttons (rendered as siblings, outside that wrapper) keep their
    `position: fixed` behavior correctly; a filter on an ancestor of a fixed
    element would otherwise change its containing block and break that.
  - All five preferences persist per-device in `localStorage` and re-apply on
    reload.
- **Single login page for every role.** `/login` is the only sign-in screen
  in the app — passengers, drivers and admins all authenticate here (via
  email/password or Google) and are routed to the right dashboard based on
  the `role` on their account, enforced server-side. Redesigned as a
  split-screen layout that states this explicitly, with role badges and the
  seeded demo-account list still available to copy-paste from.

## Live GPS tracking

Real-time driver tracking for an active ride, built into the existing app (Express + MongoDB + Socket.IO + React).

### How it works

1. **Driver** opens *My Rides → Start Ride*. A consent dialog explains what is shared; the browser then asks for
   location permission. Only after permission is granted does the ride start on the server
   (`Scheduled → Driver En Route`). GPS is read with `navigator.geolocation.watchPosition()` only while tracking is on.
2. Readings go to the server over the authenticated Socket.IO connection (HTTP fallback if the socket is down),
   throttled to one every ~4 s on the client and ≥1.5 s on the server.
3. The server validates every reading (range, accuracy, timestamp, duplicate / out-of-order / stale, teleport
   speed), stores **one latest-location document per ride**, accumulates the **authoritative distance**, and
   broadcasts to the ride's room `track:<rideId>`.
4. **Passenger** opens *My Bookings → Track My Ride Live* (only for a confirmed booking). The map updates without refresh
   and shows pickup, destination, planned route, travelled trail, distance, ETA, status timeline, driver + vehicle, fare.
5. Driver advances *Arrived at Pickup → In Progress → Reached*, then **End Ride**: distance is locked, each accepted
   booking gets its final fare + `paymentStatus: pending`, all location data for the ride is deleted, the room is closed.

### Fare calculation from the road route

**Auto fare (default when offering a ride).** Search the origin, destination and pickup points and pick each from the suggestions.
The server then asks the OSRM road-routing service for the *driving* route (origin → pickups → destination) and calculates everything itself:

```
price per seat = max(FARE_MIN, round(FARE_BASE + FARE_RATE_PER_KM × road km))      defaults: 10 + 3 × km, minimum 20
```

* `POST /api/fare/quote` previews it (the Offer Ride page shows the route on a map, road distance, drive time and the fare).
* `POST /api/rides` with `fareMode: "auto"` recalculates it on the server and **ignores any price/distance sent by the client**.
  If a place can't be located or the router is down, the ride is **not** created with a guessed price (HTTP 422/503 with a clear message); the driver can switch to **Manual**.
* **Every pickup point has its own fare**: a passenger boarding at stop *k* pays for the road distance left from that stop to the destination. The fare is snapshotted on the booking (`quotedPerSeat`), so later edits can't change it.
* The planned route is stored at creation, so passengers see it on the tracking page before the ride starts. Auto-fare rides can't have their price hand-edited.
* **Manual mode** still works exactly as before (driver types price + distance).

**Billing basis** (`services/fareService.js`), chosen by the driver per ride:

| `fareBasis` | Who is billed how |
|---|---|
| `estimated` (default) | Passenger pays their quoted fare × seats. Route deviations are **never** charged. |
| `actual` | Only passengers who ticked the consent box when booking pay `quoted fare × (GPS km driven ÷ planned km)`, capped at 125 % of the quote. Others, or rides with too little reliable GPS data (< 500 m), fall back to the quoted fare - and the UI says which basis was applied. |

Clients can never send distance or fare for the final bill - only the server writes them when the ride ends.
There is no payment gateway: `Booking.paymentStatus` (`not_due | pending | paid`) is the hook one would plug into.

### Environment variables

Backend (`backend/.env`) - see `.env.example` for the full list with defaults: `JWT_SECRET`, `MONGO_URI`, `CLIENT_URL`
(existing) plus `OSRM_BASE_URL`, `NOMINATIM_BASE_URL`, `NOMINATIM_COUNTRY_CODES`, `GEO_USER_AGENT`, `GPS_*`,
`LOCATION_HISTORY_TTL_HOURS`, `TRACKING_START_WINDOW_MINUTES`, `TRACKING_ABANDON_MINUTES`, `FARE_MAX_ACTUAL_FACTOR`,
`EMERGENCY_CONTACTS`, `FARE_BASE`, `FARE_RATE_PER_KM`, `FARE_MIN`, `FARE_ROUND_TO`.
Frontend (`frontend/.env`): `VITE_API_URL`, `VITE_SOCKET_URL` (existing), optional `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION`.
No API keys are needed: OpenStreetMap tiles, OSRM and Nominatim are keyless. Routing/geocoding are called only from the
backend, so nothing sensitive reaches the browser.

### REST API (all require `Authorization: Bearer <jwt>`)

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/tracking/rides/:rideId` | driver / confirmed passenger | Snapshot: status, route, latest location, trail, distance, driver, fare |
| `GET /api/tracking/rides/:rideId/eta` | driver / confirmed passenger | Road-based ETA (cached ~20 s); `available:false` + message when routing is down |
| `POST /api/tracking/rides/:rideId/start` \| `pause` \| `resume` \| `end` | ride's driver | Lifecycle (`end` finalizes fares) |
| `POST /api/tracking/rides/:rideId/status` `{step}` | ride's driver | `arrived_pickup` \| `in_progress` \| `reached` (forward only) |
| `POST /api/tracking/rides/:rideId/location` | ride's driver | HTTP fallback for a GPS reading |
| `GET /api/tracking/emergency-contacts` | any user | Configured emergency numbers |
| `GET /api/geo/search?q=` / `GET /api/geo/route?points=lat,lng;lat,lng` | any user | Cached, rate-limited geocoding / routing proxy |
| `POST /api/fare/quote` `{origin, destination, pickupPoints}` | driver | Road distance, drive time, route line, fare per seat and per pickup stop |

Changed existing endpoints: `POST /api/rides` accepts `fareBasis` and validates coordinates; `PATCH /api/rides/:id` no longer
accepts `status` (use the tracking endpoints) and refuses edits once a ride has started; `POST /api/bookings` accepts
`acceptDistanceBilling` (required for `actual` rides); cancelling a ride/booking immediately revokes live access;
`PATCH /api/users/profile` accepts `vehicle`.

### Socket.IO events

Connect with `io(URL, { auth: { token } })` (same JWT as REST). Client→server events use acknowledgements
`{ ok, code?, message? }`.

| Event | Direction | Payload |
|---|---|---|
| `tracking:subscribe` / `tracking:unsubscribe` | C→S | `{ rideId }` - refused unless driver or confirmed passenger |
| `tracking:location` | C→S (driver) | `{ rideId, latitude, longitude, accuracy?, heading?, speed?, timestamp? }` |
| `tracking:location` | S→room | latest accepted reading + `distanceMeters` |
| `tracking:status` | S→room | `{ rideStatus, statusLabel, trackingState }` |
| `tracking:route` | S→room | planned route became available |
| `tracking:ended` | S→room / user | `{ reason: completed \| ride_cancelled \| booking_cancelled \| booking_rejected }` |
| `tracking:fare` | S→user room | that passenger's own finalized fare |

Rejection codes: `NOT_AUTHORIZED, INVALID_COORDINATES, INVALID_ACCURACY, INVALID_TIMESTAMP, STALE, POOR_ACCURACY, DUPLICATE,
OUT_OF_ORDER, THROTTLED, IMPLAUSIBLE_JUMP, PAUSED, NOT_STARTED, RIDE_ENDED`.

### Privacy & retention

* Driver GPS is read only after explicit consent, only while a ride is active; it stops on pause, end, or leaving the page.
* Passenger location is never accessed. Admins cannot subscribe to live locations.
* `RideLocation` holds one latest point per ride; `RideLocationPoint` is a *sampled* trail (≥50 m or ≥60 s apart) used to
  redraw the path on reload. **Both are deleted when the ride ends or is cancelled**; a 24 h TTL index is only a backstop.
  Ended rides never expose a trail.
* Browsers only allow geolocation on **HTTPS** (or `localhost`). Serve production over HTTPS and set `CLIENT_URL` accordingly.

### Known limits

* Distance = sum of filtered GPS segments (straight lines between fixes ~4 s apart), not map-matched to roads.
* Movement while tracking is paused is not counted (pause is meant for stops).
* Live state is kept per Node process (per-ride locking, ETA cache); running several backend instances would need a shared
  Socket.IO adapter (e.g. Redis) and a shared lock.
* The public OSRM/Nominatim servers have usage limits; use your own instances in production. ETA has no live traffic.
* The seeded demo rides have coordinates for labels only approximately; missing coordinates are geocoded on first use.
* Road routes/geocoding use the public OSRM + Nominatim servers by default; they were only exercised against a local test double in the automated tests, so run the manual checklist against the real services.
* Browser GPS cannot be exercised from an automated test - see the manual test checklist below.

### Windows PowerShell

```powershell
# one-time: MongoDB must be running (local service or Atlas URI in backend\.env)
cd carpool-connect\backend
Copy-Item .env.example .env       # then edit JWT_SECRET / MONGO_URI
npm install
npm run seed
npm run dev                        # http://localhost:5000

# second PowerShell window
cd carpool-connect\frontend
Copy-Item .env.example .env
npm install                        # installs leaflet + react-leaflet
npm run dev                        # http://localhost:5173

# automated backend tests (needs a reachable MongoDB; uses a throwaway database)
cd carpool-connect\backend
$env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017/carpool_connect_test"
npm test
```

If PowerShell blocks `npm`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

### Manual test checklist (real browser GPS)

1. Log in as a driver (`asha.driver@carpoolconnect.app`, `Carpool@123`), *Profile* → add vehicle, then offer a ride (use the
   search button beside each place to pin coordinates). Leave **Auto (road route)** selected: the map preview should show the
   road route, distance, drive time and a fare per seat (and per pickup point) within a second or two.
2. Log in as a passenger in another browser, book the ride, accept it as the driver.
3. Driver: *My Rides → Start Ride → Allow*. Passenger: *My Bookings → Track My Ride Live* - the marker should move as the
   driver moves (use a phone on the same network over HTTPS, or Chrome DevTools → Sensors to feed locations).
4. Driver: Arrived at pickup → Start trip → Reached → End Ride. Check the passenger's fare, *My Bookings* and that tracking stopped.
5. Auth: stay on a page for 16+ minutes (the access token renews silently - you should not be logged out), then use *Profile → Sign out of all devices* and confirm a second browser is signed out.
6. Try: deny location permission, switch off Wi-Fi, cancel a booking mid-ride, open the tracking URL as a different user.

## Authentication: JWT sessions + Google OAuth

### JWT sessions

| Piece | Details |
|---|---|
| Access token | JWT (HS256, issuer + audience checked), **15 min** (`JWT_EXPIRES_IN`). Sent as `Authorization: Bearer`. Carries a token version so it can be revoked. |
| Refresh token | Random 48-byte value in an **httpOnly** cookie `cc_refresh` (path `/api/auth`, `SameSite=Lax`, `Secure` in production). Only its SHA-256 hash is stored. **Rotated on every use**; replaying an old one revokes the whole login session. Lifetime `REFRESH_TOKEN_DAYS` (30). |
| Frontend | Renews the access token silently (before expiry and on any 401), restores the session after a reload, and signs out locally first on logout. |
| Sockets | The Socket.IO handshake uses the same token and the same checks (active account, session not ended); the role comes from the database, not the token. |
| Startup check | The server refuses to boot in production with a missing, placeholder or < 32-character `JWT_SECRET`. |
| Brute force | `/auth/login|register|google|refresh` are rate limited (30 / 15 min per IP). Set `TRUST_PROXY` behind a proxy. |

Endpoints: `POST /api/auth/register | login | google` (return `token`, set the cookie), `POST /api/auth/refresh`,
`POST /api/auth/logout` (this browser), `POST /api/auth/logout-all` (every device, protected; also kills live sockets), `GET /api/auth/me`.
`/refresh` and `/logout` also reject requests whose `Origin` is not `CLIENT_URL`.

Upgrading note: tokens issued by the previous version (7-day, no issuer/audience) are rejected, so everyone signs in once after deploying.

### Google OAuth (needs YOUR Google client ID)

Google sign-in cannot work until you create a client ID - nothing in this repo can do that for you. Until `VITE_GOOGLE_CLIENT_ID` is set the buttons are hidden
(the login page shows a dev note) and `POST /api/auth/google` answers `501`.

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Web application**.
   (First time: configure the OAuth consent screen, add yourself as a test user.)
2. *Authorized JavaScript origins*: `http://localhost:5173` (and your production URL). No redirect URI is needed (Google Identity Services ID-token flow).
3. Put the client ID in **both** `backend/.env` (`GOOGLE_CLIENT_ID=...`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID=...`), then restart both servers.

How it behaves (all covered by `backend/tests/auth.integration.test.js`):
* The ID token is verified on the server (signature, audience, issuer, expiry); only accounts with a **verified Google email** are accepted.
* **Sign up with Google** on the Register page uses the chosen role (passenger / driver) and gender for *new* accounts. `admin` can never be self-assigned, and signing in again never changes an existing role.
* Same Google account → same user. Linking Google to an existing **email-verified** password account keeps its password.
* **Anti-takeover rule:** if the existing password account's email was never verified (this app has no email-verification step for password sign-ups), linking Google
  *removes that password* and ends its sessions - otherwise someone who pre-registered your address could keep access. The person is told on screen.
* New Google users get the same JWT + refresh-cookie session as password users.

## Feature list (full)

- Registration/login (JWT) **and** Google OAuth login, role-based authorization
  (passenger/driver/admin) enforced on the backend
- Ride creation, search (origin/destination/date/women-only filters), ride
  details, edit/cancel
- Multiple pickup points per ride, chosen by the passenger at booking time
- Bookings: request → accept/reject → cancel, with seat count kept in sync
  server-side
- Smart waiting list: join/leave, position tracking, automatic promotion +
  notification when a seat frees up
- Alternative-route matching: explainable substring/time-window matching
  service, used automatically when an exact search returns nothing
- Women-Only ride preference: gender-gated on the backend for both creating
  and booking, with a dedicated safety-info page
- **Real-time SOS safety alerts** broadcast to all admins via Socket.IO (see #10 above)
- Lost & Found: driver reports an item on a specific ride; only passengers
  with an *accepted* booking on that ride are notified; claim workflow with
  status (open/claimed/returned/closed)
- Notification Center, persisted via REST, plus live push for SOS alerts
- Ratings & reviews: one review per (ride, reviewer, reviewee), average
  rating recomputed on the user
- Eco Impact dashboard: clearly-labeled *estimates* with documented assumptions
- Simulated live trip status (scheduled → preparing → started → pickup in
  progress → on the way → reached → completed) — no real GPS, by design
- Saved routes with quick re-search
- Safety reporting from any ride's details page, with an admin moderation queue
- Admin dashboard: platform stats, user management, ride oversight,
  safety-report triage, live SOS queue, API docs link
- **Rule-based support chatbot** (no external API key)
- **"Recently viewed" rides** per user
- **English/Tamil UI** via react-i18next
- **Swagger API docs** at `/api-docs`
- **API-key-authenticated public integration endpoints** (`/api/public/*`)
- React: custom context providers (Auth, Theme, Notification, Ride), custom
  hooks, light/dark theme

## Known limitations / what you'd extend next

- No mapping/geocoding integration — locations are free-text labels, and
  "distance" is a number the driver enters manually. The matching and
  eco-impact services are intentionally simple and explainable rather than
  GPS-accurate.
- The chatbot is intent/keyword-based, not a general-purpose LLM — it will
  say so ("I didn't quite catch that...") rather than guess on anything
  outside its known topics.
- No automated test suite (Jest/RTL etc.) is included — the codebase is
  structured (thin controllers, isolated services) to make adding one
  straightforward.
- No payment gateway integration, per project scope.

## Project structure

```
carpool-connect/
├── backend/     — Express API, MongoDB models, Socket.IO, Swagger docs
│   └── src/
│       ├── config/       — db.js, googleClient.js, swagger.js
│       ├── controllers/  — incl. sosController, chatbotController, publicApiController
│       ├── middleware/   — incl. apiKeyAuth.js
│       ├── models/       — incl. SOSAlert.js
│       ├── routes/       — incl. sosRoutes, chatbotRoutes, publicRoutes
│       ├── sockets/       — Socket.IO auth + admin room + broadcastSOS
│       └── utils/seed.js  — 7-account, realistic seed data
└── frontend/    — React 18 + Vite SPA
    └── src/
        ├── i18n/                          — English + Tamil translations
        ├── components/chatbot/            — ChatbotWidget
        ├── components/safety/             — SOSButton
        ├── components/rides/RecentlyViewed.jsx
        └── pages/Admin/SafetyAlerts.jsx   — live SOS queue
```
