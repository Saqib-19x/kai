const mongoose = require('mongoose');

// Add this new schema for knowledge sources
const KnowledgeSourceSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ['document', 'website', 'text', 'qa'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceType',
    required: function() {
      return this.sourceType === 'document';
    }
  },
  url: {
    type: String,
    required: function() {
      return this.sourceType === 'website';
    },
    validate: {
      validator: function(v) {
        return /^(http|https):\/\/[^ "]+$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  content: {
    type: String,
    required: function() {
      return this.sourceType === 'text' || this.sourceType === 'qa';
    }
  },
  metadata: {
    type: Object,
    default: {}
  }
});

const AgentConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name for your agent'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  model: {
    type: String,
    enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
    default: 'gpt-3.5-turbo'
  },
  systemPrompt: {
    type: String,
    required: [true, 'Please define a system prompt for your agent'],
    maxlength: [4000, 'System prompt cannot be more than 4000 characters']
  },
  temperature: {
    type: Number,
    min: 0,
    max: 2,
    default: 0.7
  },
  expertise: [{
    type: String,
    trim: true
  }],
  personality: {
    type: String,
    enum: ['professional', 'friendly', 'technical', 'creative', 'concise', 'detailed'],
    default: 'professional'
  },
  maxTokens: {
    type: Number,
    min: 100,
    max: 4000,
    default: 1000
  },
  knowledgeSources: [KnowledgeSourceSchema],
  allowedDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  trainingData: {
    type: String,
    select: false // Only load when explicitly requested
  },
  avatar: {
    type: String,
    default: 'default-agent.png'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  embedSettings: {
    primaryColor: {
      type: String,
      default: '#0084ff'
    },
    position: {
      type: String,
      enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
      default: 'bottom-right'
    },
    welcomeMessage: {
      type: String,
      default: 'Hi! Ask me anything!'
    },
    bubbleIcon: {
      type: String,
      default: 'default'
    },
    showBranding: {
      type: Boolean,
      default: true
    },
    autoOpen: {
      type: Boolean,
      default: false
    },
    width: {
      type: String,
      default: '380px'
    },
    height: {
      type: String,
      default: '500px'
    }
  }
});

// Pre-save hook to update the 'updatedAt' field
AgentConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to generate a complete system prompt based on configuration
AgentConfigSchema.methods.generateCompleteSystemPrompt = function() {
  let prompt = this.systemPrompt;
  
  // Add personality traits
  const personalityPrompts = {
    professional: 'Maintain a professional tone. Be clear, respectful, and focused on providing valuable information.',
    friendly: 'Be conversational, warm, and approachable. Use casual language and show empathy.',
    technical: 'Focus on technical accuracy and detail. Use precise terminology and provide in-depth explanations.',
    creative: 'Be imaginative and think outside the box. Suggest innovative approaches and ideas.',
    concise: 'Be brief and to the point. Prioritize clarity and efficiency in your responses.',
    detailed: 'Provide comprehensive explanations with examples and context. Be thorough in your responses.'
  };
  
  prompt += `\n\n${personalityPrompts[this.personality] || personalityPrompts.professional}`;
  
  // Add expertise areas if defined
  if (this.expertise && this.expertise.length > 0) {
    prompt += `\n\nYou are an expert in: ${this.expertise.join(', ')}.`;
  }
  
  return prompt;
};

module.exports = mongoose.model('AgentConfig', AgentConfigSchema); 