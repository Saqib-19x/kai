const express = require('express');
const router = express.Router();
const {
  getSummaryMetrics,
  getEndpointStats,
  getUserActivityStats,
  getResourceUsageStats,
  getDailyStats,
  getMyStats,
  getAiUsage,
  getDailyAiUsage,
  getUserAiUsage,
  getMyAiUsage,
  getAgentStats,
  getChatStats,
  getChatBillingInfo,
  getMyChatStats,
  getMyAgentStats,
  getMyChatBillingInfo,
  getMyDashboardStats
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

// AI usage reports (admin only)
router
  .route('/ai-usage')
  .get(authorize('admin'), getAiUsage);

router
  .route('/ai-usage/daily')
  .get(authorize('admin'), getDailyAiUsage);

router
  .route('/ai-usage/users')
  .get(authorize('admin'), getUserAiUsage);

// Personal AI usage report
router
  .route('/me/ai-usage')
  .get(getMyAiUsage);

// Agent statistics
router
  .route('/agents')
  .get(authorize('admin'), getAgentStats);

// Chat statistics
router
  .route('/chats')
  .get(authorize('admin'), getChatStats);

// Chat billing information
router
  .route('/chats/billing')
  .get(authorize('admin'), getChatBillingInfo);

// User-specific chat statistics
router
  .route('/me/chats')
  .get(getMyChatStats);

// User-specific reporting routes (no admin authorization needed)
router.get('/me/stats', getMyStats);

// Add new user-specific routes
router.get('/me/agents', getMyAgentStats);
router.get('/me/chats', getMyChatStats);
router.get('/me/billing', getMyChatBillingInfo);
router.get('/me/dashboard', getMyDashboardStats);

module.exports = router; 