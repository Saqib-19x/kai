const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload');
const {
  uploadDocument,
  getDocument,
  getAllDocuments,
  deleteDocument
} = require('../controllers/documentController');

// Import auth middleware
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Important: Place specific routes BEFORE parameterized routes
// File upload route
router.post('/upload', upload.single('file'), uploadDocument);

// Other document routes
router.get('/', getAllDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

module.exports = router; 