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
    type: Number,
    default: Date.now
  }
});

const CallSessionSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VoiceAgent',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  elevenlabsCallId: {
    type: String
  },
  status: {
    type: String,
    enum: ['scheduled', 'initiating', 'initiated', 'in-progress', 'completed', 'failed'],
    default: 'initiating'
  },
  duration: {
    type: Number,
    default: 0
  },
  messages: [MessageSchema],
  metadata: {
    type: Object,
    default: {}
  },
  metrics: {
    userSentiment: {
      type: Number,
      min: -1,
      max: 1,
      default: 0
    },
    successfulOutcome: {
      type: Boolean,
      default: false
    },
    callQuality: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    }
  },
  recordingUrl: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('CallSession', CallSessionSchema); 