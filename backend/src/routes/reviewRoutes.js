const express = require('express');
const { protect } = require('../middleware/auth');
const { createReview, getReviewsForUser } = require('../controllers/reviewController');

const router = express.Router();

router.post('/', protect, createReview);
router.get('/user/:userId', protect, getReviewsForUser);

module.exports = router;
