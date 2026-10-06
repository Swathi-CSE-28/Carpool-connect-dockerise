// Hand-authored OpenAPI 3.0 spec (no build step / jsdoc scanning needed).
// Served at GET /api-docs via swagger-ui-express.
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'CarPool Connect API',
    version: '1.0.0',
    description:
      'Smart, safe & sustainable campus ride-sharing platform. JWT auth (email/password or Google OAuth) ' +
      'for the main app, plus a separate API-key-authenticated read-only integration surface under /api/public.'
  },
  servers: [{ url: '/api', description: 'Current host' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['passenger', 'driver', 'admin'] },
          authProvider: { type: 'string', enum: ['local', 'google'] },
          preferredLanguage: { type: 'string', enum: ['en', 'ta'] }
        }
      },
      Ride: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          origin: { type: 'object', properties: { label: { type: 'string' } } },
          destination: { type: 'object', properties: { label: { type: 'string' } } },
          departureTime: { type: 'string', format: 'date-time' },
          seatsAvailable: { type: 'number' },
          womenOnly: { type: 'boolean' },
          status: { type: 'string' }
        }
      },
      SOSAlert: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] },
          location: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' }, label: { type: 'string' } } }
        }
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register with email + password',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, role: { type: 'string', enum: ['passenger', 'driver'] } }, required: ['name', 'email', 'password'] } } } },
        responses: { 201: { description: 'Created' }, 400: { description: 'Validation error / email in use' } }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login with email + password',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] } } } },
        responses: { 200: { description: 'JWT + user' }, 401: { description: 'Invalid credentials' } }
      }
    },
    '/auth/google': {
      post: {
        tags: ['Auth'], summary: 'Login/register via Google OAuth ID token',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { credential: { type: 'string', description: 'Google Identity Services ID token' } }, required: ['credential'] } } } },
        responses: { 200: { description: 'JWT + user' }, 501: { description: 'Google OAuth not configured' } }
      }
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Get the logged-in user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Current user' } } }
    },
    '/auth/api-key': {
      post: { tags: ['Auth'], summary: 'Generate/rotate a personal API key for /api/public/*', security: [{ bearerAuth: [] }], responses: { 200: { description: 'New API key' } } }
    },
    '/rides': {
      get: { tags: ['Rides'], summary: 'Search scheduled rides', security: [{ bearerAuth: [] }], parameters: [{ name: 'origin', in: 'query', schema: { type: 'string' } }, { name: 'destination', in: 'query', schema: { type: 'string' } }, { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'womenOnly', in: 'query', schema: { type: 'boolean' } }], responses: { 200: { description: 'Rides list' } } },
      post: { tags: ['Rides'], summary: 'Create a ride (driver only)', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } }
    },
    '/rides/recent': {
      get: { tags: ['Rides'], summary: "Current user's recently viewed rides", security: [{ bearerAuth: [] }], responses: { 200: { description: 'Recently viewed rides, most recent first' } } }
    },
    '/rides/women-only': {
      get: { tags: ['Rides'], summary: 'List Women-Only rides', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Rides list' } } }
    },
    '/rides/{id}': {
      get: { tags: ['Rides'], summary: 'Get one ride (also logs it in "recently viewed")', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Ride' }, 404: { description: 'Not found' } } }
    },
    '/sos': {
      post: { tags: ['Safety / SOS'], summary: 'Trigger an emergency SOS alert (broadcast live to all admins)', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { rideId: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' }, label: { type: 'string' }, message: { type: 'string' } } } } } }, responses: { 201: { description: 'Alert created' } } },
      get: { tags: ['Safety / SOS'], summary: 'List active/acknowledged SOS alerts (admin only)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Alerts' } } }
    },
    '/sos/mine': {
      get: { tags: ['Safety / SOS'], summary: "Current user's own SOS history", security: [{ bearerAuth: [] }], responses: { 200: { description: 'Alerts' } } }
    },
    '/sos/{id}/acknowledge': {
      patch: { tags: ['Safety / SOS'], summary: 'Acknowledge an alert (admin only)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated alert' } } }
    },
    '/sos/{id}/resolve': {
      patch: { tags: ['Safety / SOS'], summary: 'Resolve an alert (admin only)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated alert' } } }
    },
    '/chatbot/message': {
      post: { tags: ['Chatbot'], summary: 'Send a message to the rule-based support assistant (public)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } } } }, responses: { 200: { description: 'Bot reply + suggestions' } } }
    },
    '/admin/stats': {
      get: { tags: ['Admin'], summary: 'Dashboard stats (admin only)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Stats' } } }
    },
    '/public/rides': {
      get: { tags: ['Public Integration API'], summary: 'Read-only ride listing for external integrations', security: [{ apiKeyAuth: [] }], responses: { 200: { description: 'Rides' }, 401: { description: 'Missing/invalid API key' } } }
    },
    '/public/stats': {
      get: { tags: ['Public Integration API'], summary: 'Read-only platform stats for external integrations', security: [{ apiKeyAuth: [] }], responses: { 200: { description: 'Stats' } } }
    }
  }
};

module.exports = swaggerSpec;
