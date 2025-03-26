const express = require('express');
const {
  createAgent,
  getAgents,
  getAgent,
  updateAgent,
  patchAgent,
  deleteAgent,
  trainAgent,
  startConversation,
  updateEmbedSettings,
  getAgentAnalytics
} = require('../controllers/agentController');

const router = express.Router();

// Import auth middleware
const { protect, authorize } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

router
  .route('/')
  .get(getAgents)
  .post(createAgent);

router
  .route('/:id')
  .get(getAgent)
  .put(updateAgent)
  .delete(deleteAgent)
  .patch(patchAgent);

router
  .route('/:id/train')
  .post(trainAgent);

router
  .route('/:id/converse')
  .post(startConversation);

router
  .route('/:id/embed-settings')
  .put(updateEmbedSettings);

router.get('/:id/analytics', getAgentAnalytics);

module.exports = router; 