const express = require('express');
const { protect } = require('../middleware/auth');
const { getMyEcoImpact } = require('../controllers/ecoController');

const router = express.Router();
router.get('/my', protect, getMyEcoImpact);

module.exports = router;
