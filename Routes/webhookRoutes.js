const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// ElevenLabs webhooks
router.route('/elevenlabs/call-status')
  .post(webhookController.handleCallStatus);

router.route('/elevenlabs/conversation')
  .post(webhookController.handleConversationUpdate);

module.exports = router; 