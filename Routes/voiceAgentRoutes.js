const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const voiceAgentController = require('../controllers/voiceAgentController');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// Voice agent collection routes
router.route('/')
  .get(protect, voiceAgentController.getVoiceAgents)
  .post(protect, voiceAgentController.createVoiceAgent);

// IMPORTANT: Put specific routes BEFORE parameter routes
// Voice listing route
router.route('/voices')
  .get(protect, voiceAgentController.getVoices);

// Knowledge base routes
router.route('/knowledge-base')
  .get(protect, voiceAgentController.getKnowledgeBases)
  .post(protect, upload.single('file'), voiceAgentController.createKnowledgeBase);

router.route('/knowledge-base/:knowledgeBaseId/upload')
  .post(
    protect, 
    upload.single('file'), // Specifically expecting 'file' as the field name
    voiceAgentController.uploadToKnowledgeBase
  );

// Individual voice agent routes - PUT AFTER specific routes
router.route('/:id')
  .get(protect, voiceAgentController.getVoiceAgent)
  .put(protect, voiceAgentController.updateVoiceAgent)
  .delete(protect, voiceAgentController.deleteVoiceAgent);

// Call routes
router.route('/:id/call')
  .post(protect, voiceAgentController.initiateAgentCall);

router.route('/:id/calls')
  .get(protect, voiceAgentController.getAgentCallHistory);


// Voice agent routes
router.route('/')
  .get(protect, voiceAgentController.getVoiceAgents)
  .post(protect, voiceAgentController.createVoiceAgent);

// This route is catching everything!
router.route('/:id')
  .get(protect, voiceAgentController.getVoiceAgent)
  .put(protect, voiceAgentController.updateVoiceAgent)
  .delete(protect, voiceAgentController.deleteVoiceAgent);

// Call initiation
router.route('/:id/call')
  .post(protect, voiceAgentController.initiateAgentCall);

// Call history
router.route('/:id/calls')
  .get(protect, voiceAgentController.getAgentCallHistory);

// Knowledge base management
router.route('/knowledge-base')
  .get(protect, voiceAgentController.getKnowledgeBases)
  .post(protect, upload.single('file'), voiceAgentController.createKnowledgeBase);

router.route('/knowledge-base/:knowledgeBaseId/upload')
  .post(protect, upload.array('files'), voiceAgentController.uploadKnowledgeBase);

// Voice selection
router.route('/voices')
  .get(protect, voiceAgentController.getVoices);

// Upload to existing knowledge base
router.route('/knowledge-base/:knowledgeBaseId/upload')
  .post(protect, upload.single('file'), voiceAgentController.uploadToKnowledgeBase);

// Create agent with knowledge base
router.route('/agents')
  .post(protect, voiceAgentController.createAgentWithKnowledgeBase);

module.exports = router; 
