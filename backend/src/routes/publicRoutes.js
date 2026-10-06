const express = require('express');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { listPublicRides, publicStats } = require('../controllers/publicApiController');

const router = express.Router();

// All routes here use x-api-key auth (see POST /api/auth/api-key), not JWT
router.use(apiKeyAuth);

router.get('/rides', listPublicRides);
router.get('/stats', publicStats);

module.exports = router;
