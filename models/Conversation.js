const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  language: {
    type: String,
    default: 'en'
  }
});

const ConversationSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'New Conversation',
    trim: true
  },
  messages: [MessageSchema],
  documentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  language: {
    type: String,
    default: 'en'
  },
  userPreferences: {
    type: Object,
    default: {}
  },
  summary: {
    type: String,
    default: ''
  },
  analytics: {
    type: Object,
    default: {
      interactionCount: 0,
      topicsSummary: [],
      sentimentScore: 0
    }
  },
  metadata: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
ConversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Conversation', ConversationSchema); 