# CarPool Connect — Backend

Express + MongoDB REST API with JWT auth, role-based authorization, and a
Socket.IO layer for future live-push delivery.

## Setup

```bash
cp .env.example .env   # set MONGO_URI and a real JWT_SECRET
npm install
npm run seed            # optional demo data — wipes Users & Rides collections
npm run dev              # nodemon, http://localhost:5000
# or: npm start
```

Requires a running MongoDB instance reachable at `MONGO_URI` (local `mongod`,
Docker, or Atlas all work).

## Structure

```
src/
├── config/db.js         Mongoose connection
├── models/               User, Ride, Booking, Waitlist, Notification,
│                          LostItem, Review, SavedRoute, Report
├── middleware/            auth (JWT), role (authorize), validate, errorHandler
├── controllers/          one per resource, thin — business rules live here
├── routes/                 one per resource, mounted in app.js
├── services/               matchingService (alternative routes),
│                          ecoService (eco-impact estimates)
├── sockets/index.js       JWT-authenticated Socket.IO room setup
├── utils/                 asyncHandler, generateToken, apiError, seed.js
├── app.js                  Express app (no listen())
└── server.js                Creates the HTTP server + Socket.IO, connects DB, listens
```

## API overview

See the root README's feature list, or read the route files directly under
`src/routes/` — each is short and self-explanatory. Health check: `GET /api/health`.

All protected routes require `Authorization: Bearer <token>`. Role checks
(`authorize('driver')`, etc.) live in the route definitions, and ownership
checks (e.g. "only the ride's own driver can edit it") live in the
controllers — never trust an id from the request body for authorization
decisions; the authenticated `req.user` is always the source of truth.
