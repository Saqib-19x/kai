const express = require('express');
const router = express.Router();
const {
  handleIncomingCall,
  respondToCall,
  processTranscription
} = require('../controllers/voiceController');

// Import auth middleware
const { protect } = require('../middleware/auth');

// Voice routes (Twilio webhooks don't need protection, but internal routes do)
router.post('/incoming', handleIncomingCall);
router.post('/respond', respondToCall);
router.post('/transcribe', processTranscription);

// Add any protected voice routes here
// router.get('/history', protect, getVoiceHistory);

module.exports = router; 