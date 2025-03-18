const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: false,
    default: ""
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  textLength: {
    type: Number,
    default: 0
  },
  languageHint: {
    type: String,
    default: 'eng'
  },
  processingCompletedAt: {
    type: Date,
    default: null
  },
  searchKeywords: [{
    type: String
  }],
  chunks: [{
    index: Number,
    text: String,
    startPosition: Number,
    endPosition: Number
  }],
  metadata: {
    title: String,
    author: String,
    creationDate: Date,
    pageCount: Number,
    detectedLanguage: String,
    confidence: Number
  }
});

// Add method to chunk document for better retrieval
DocumentSchema.methods.chunkDocument = async function(chunkSize = 1000, overlap = 200) {
  const text = this.extractedText;
  if (!text) return;
  
  const chunks = [];
  let startPosition = 0;
  
  while (startPosition < text.length) {
    const endPosition = Math.min(startPosition + chunkSize, text.length);
    
    chunks.push({
      index: chunks.length,
      text: text.substring(startPosition, endPosition),
      startPosition,
      endPosition
    });
    
    startPosition = endPosition - overlap;
    if (startPosition < endPosition) startPosition = endPosition;
  }
  
  this.chunks = chunks;
  return this.save();
};

module.exports = mongoose.model('Document', DocumentSchema); 