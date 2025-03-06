const express = require('express');
const {
  register,
  login,
  getMe,
  logout
} = require('../controllers/authController');

const router = express.Router();

// Import auth middleware
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

module.exports = router; 