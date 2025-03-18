const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    required: true
  },
  responseTime: {
    type: Number,
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  requestBody: {
    type: Object,
    select: false // Don't return this by default for security
  },
  requestParams: {
    type: Object,
    select: false // Don't return this by default for security
  },
  requestQuery: {
    type: Object,
    select: false // Don't return this by default for security
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'resourceModel'
  },
  resourceModel: {
    type: String,
    enum: ['Document', 'Conversation', null]
  },
  aiUsage: {
    model: {
      type: String,
      default: null
    },
    promptTokens: {
      type: Number,
      default: 0
    },
    completionTokens: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    cost: {
      type: Number,
      default: 0
    },
    customerPrice: {
      type: Number,
      default: 0
    }
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better query performance
ReportSchema.index({ userId: 1, timestamp: -1 });
ReportSchema.index({ endpoint: 1, timestamp: -1 });
ReportSchema.index({ 'aiUsage.model': 1 });

module.exports = mongoose.model('Report', ReportSchema); 