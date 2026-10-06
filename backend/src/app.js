const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const rideRoutes = require('./routes/rideRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const lostItemRoutes = require('./routes/lostItemRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const savedRouteRoutes = require('./routes/savedRouteRoutes');
const reportRoutes = require('./routes/reportRoutes');
const ecoRoutes = require('./routes/ecoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sosRoutes = require('./routes/sosRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const publicRoutes = require('./routes/publicRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const geoRoutes = require('./routes/geoRoutes');
const fareRoutes = require('./routes/fareRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY); // set when behind a reverse proxy
app.use(cookieParser());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ success: true, message: 'CarPool Connect API is running' }));

// Interactive API documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'CarPool Connect API Docs' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lost-items', lostItemRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/saved-routes', savedRouteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/eco', ecoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/fare', fareRoutes);
app.use('/api/public', publicRoutes); // API-key authenticated, for external integrations

app.use(notFound);
app.use(errorHandler);

module.exports = app;
