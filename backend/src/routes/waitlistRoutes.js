const express = require('express');
const { protect } = require('../middleware/auth');
const { joinWaitlist, getMyWaitlist, leaveWaitlist } = require('../controllers/waitlistController');

const router = express.Router();

router.post('/', protect, joinWaitlist);
router.get('/my', protect, getMyWaitlist);
router.delete('/:id', protect, leaveWaitlist);

module.exports = router;
