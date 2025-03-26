const express = require('express');
const {
  register,
  login,
  getMe,
  logout,
  generateApiKey,
  listApiKeys,
  revokeApiKey
} = require('../controllers/authController');

const router = express.Router();

// Import auth middleware
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

// API key routes
router.post('/api-keys', protect, generateApiKey);
router.get('/api-keys', protect, listApiKeys);
router.delete('/api-keys/:keyId', protect, revokeApiKey);

module.exports = router; 