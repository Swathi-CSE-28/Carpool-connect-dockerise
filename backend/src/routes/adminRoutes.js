const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const {
  getDashboardStats, getUsers, updateUserStatus, getAllRides,
  getReports, updateReportStatus, getLostItemsModeration
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.get('/rides', getAllRides);
router.get('/reports', getReports);
router.patch('/reports/:id', updateReportStatus);
router.get('/lost-items', getLostItemsModeration);

module.exports = router;
