const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getMySavedRoutes, createSavedRoute, updateSavedRoute, deleteSavedRoute
} = require('../controllers/savedRouteController');

const router = express.Router();

router.get('/my', protect, getMySavedRoutes);
router.post('/', protect, createSavedRoute);
router.patch('/:id', protect, updateSavedRoute);
router.delete('/:id', protect, deleteSavedRoute);

module.exports = router;
