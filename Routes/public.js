const express = require('express');
const { 
  createPublicConversation,
  sendPublicMessage
} = require('../controllers/publicController');

const router = express.Router();

// No authentication required for these routes
router.post('/conversations', createPublicConversation);
router.post('/conversations/:id/messages', sendPublicMessage);

module.exports = router; 