const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  startChat,
  sendMessage,
  getChatHistory,
  getChatDetail,
  getAnalytics,
  deleteChat
} = require('../controllers/conversationController');

// Protect all routes
router.use(protect);

// Chat routes
router.post('/start', startChat);
router.post('/:conversationId/message', sendMessage);
router.get('/', getChatHistory);
router.get('/:conversationId', getChatDetail);
router.get('/:id/analytics', getAnalytics);
router.delete('/:conversationId', deleteChat);

module.exports = router;
