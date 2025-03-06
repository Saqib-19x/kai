const express = require('express');
const router = express.Router();
const {
  makeCall,
  getInitialGreeting,
  handleCallStatus,
  handleAmdStatus
} = require('../controllers/voiceController');
const {
  handleVoiceResponse
} = require('../controllers/voiceResponseController');

// Import auth middleware
const { protect } = require('../middleware/auth');

// Public routes (Twilio webhooks)
router.post('/initial-greeting', getInitialGreeting);
router.post('/respond', handleVoiceResponse);
router.post('/status', handleCallStatus);
router.post('/amd-status', handleAmdStatus);

// Protected routes (require authentication)
router.post('/call', protect, makeCall);

module.exports = router; 