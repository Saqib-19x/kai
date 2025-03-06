const Document = require('../models/Document');
const documentProcessor = require('../services/documentProcessor');
const asyncHandler = require('../middleware/async');
const path = require('path');

// @desc    Upload a new document
// @route   POST /api/documents/upload
// @access  Public
exports.uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Please upload a file'
    });
  }

  // Create document in database
  const document = await Document.create({
    fileName: req.file.filename,
    originalName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    filePath: req.file.path
  });

  // Start processing the document in the background
  documentProcessor.processDocument(document._id)
    .catch(error => console.error(`Error processing document ${document._id}:`, error));

  res.status(201).json({
    success: true,
    data: document
  });
});

// @desc    Get document by ID
// @route   GET /api/documents/:id
// @access  Public
exports.getDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);
  
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Get all documents
// @route   GET /api/documents
// @access  Public
exports.getAllDocuments = asyncHandler(async (req, res, next) => {
  const documents = await Document.find().sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: documents.length,
    data: documents
  });
});

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Public
exports.deleteDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);
  
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  await document.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
}); 