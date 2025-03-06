const express = require('express');
const router = express.Router();
const {
  createConversation,
  getConversations,
  getConversation,
  sendMessage,
  deleteConversation
} = require('../controllers/conversationController');

// Import auth middleware
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Conversation routes
router.post('/', createConversation);
router.get('/', getConversations);
router.get('/:id', getConversation);
router.post('/:id/messages', sendMessage);
router.delete('/:id', deleteConversation);

module.exports = router; 