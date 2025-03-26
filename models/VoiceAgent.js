const mongoose = require('mongoose');

const VoiceAgentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  description: {
    type: String,
    default: ''
  },
  elevenLabsAgentId: {
    type: String,
    unique: true,
    sparse: true
  },
  systemPrompt: {
    type: String,
    required: [true, 'Please add a system prompt']
  },
  voiceProfile: {
    provider: {
      type: String,
      enum: ['elevenlabs', 'playht', 'azure', 'aws'],
      default: 'elevenlabs'
    },
    voiceId: {
      type: String,
      required: [true, 'Please select a voice']
    },
    settings: {
      type: Object,
      default: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1.0
      }
    }
},
knowledgeBaseIds: [{
  type: String
}],
llmConfig: {
  model: {
    type: String,
    default: 'gpt-4o'
  },
  temperature: {
    type: Number,
    default: 0.7
  },
  maxTokens: {
    type: Number,
    default: 150
  },
  topP: {
    type: Number,
    default: 1.0
  }
},
callStats: {
  totalCalls: { 
    type: Number, 
    default: 0 
  },
  averageDuration: { 
    type: Number, 
    default: 0 
  },
  successRate: { 
    type: Number, 
    default: 0 
  }
},
isActive: {
  type: Boolean,
  default: true
}
}, { timestamps: true });

// Increment call stats when a new call is made
VoiceAgentSchema.methods.incrementCallStats = async function(callDuration, successful) {
const currentTotalCalls = this.callStats.totalCalls;
const currentAvgDuration = this.callStats.averageDuration;
const currentSuccessRate = this.callStats.successRate;

// Calculate new average duration
const newAvgDuration = 
  (currentTotalCalls * currentAvgDuration + callDuration) / (currentTotalCalls + 1);

// Calculate new success rate
const newSuccessCount = 
  (currentSuccessRate * currentTotalCalls / 100) + (successful ? 1 : 0);
const newSuccessRate = 
  (newSuccessCount / (currentTotalCalls + 1)) * 100;

// Update stats
this.callStats.totalCalls += 1;
this.callStats.averageDuration = newAvgDuration;
this.callStats.successRate = newSuccessRate;

return this.save();
};

module.exports = mongoose.model('VoiceAgent', VoiceAgentSchema);