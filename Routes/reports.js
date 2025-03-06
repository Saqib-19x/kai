const express = require('express');
const router = express.Router();
const {
  getSummaryMetrics,
  getEndpointStats,
  getUserActivityStats,
  getResourceUsageStats,
  getDailyStats,
  getMyStats
} = require('../controllers/reportController');

// Import auth middleware
const { protect, authorize } = require('../middleware/auth');

// Protect all routes with authentication
router.use(protect);

// User-level report route
router.get('/me', getMyStats);

// Admin-only routes
router.get('/summary', authorize('admin'), getSummaryMetrics);
router.get('/endpoints', authorize('admin'), getEndpointStats);
router.get('/users', authorize('admin'), getUserActivityStats);
router.get('/resources/:resourceType', authorize('admin'), getResourceUsageStats);
router.get('/daily', authorize('admin'), getDailyStats);

module.exports = router; 