const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const AgentConfig = require('../models/AgentConfig');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const openaiService = require('../services/openaiService');

// @desc    Create a new agent configuration
// @route   POST /api/agents
// @access  Private
exports.createAgent = asyncHandler(async (req, res, next) => {
  // Check if name is provided
  if (!req.body.name) {
    return next(new ErrorResponse('Please provide a name for the agent', 400));
  }

  // Add user to request body
  req.body.user = req.user.id;
  
  // Check if user is allowed to create more agents (limit to 5 for non-admin)
  if (req.user.role !== 'admin') {
    const agentsCount = await AgentConfig.countDocuments({ user: req.user.id });
    if (agentsCount >= 5) {
      return next(new ErrorResponse('You have reached the maximum number of agents (5)', 400));
    }
  }
  
  // Create agent with minimal required fields
  const agent = await AgentConfig.create({
    name: req.body.name,
    user: req.user.id,
    description: req.body.description || `AI Assistant - ${req.body.name}`, // Default description
    isPublic: false,
    systemPrompt: 'I am a helpful AI assistant.',
    knowledgeSources: [],
    trainingData: '', // Set as empty string instead of array
  });
  
  res.status(201).json({
    success: true,
    data: agent,
    message: 'Agent created successfully. Use PATCH request to configure additional settings.'
  });
});

// @desc    Get all agents for current user
// @route   GET /api/agents
// @access  Private
exports.getAgents = asyncHandler(async (req, res, next) => {
  let query;
  
  // If user is admin, they can see all agents or filter by user
  if (req.user.role === 'admin' && req.query.user) {
    query = AgentConfig.find({ user: req.query.user });
  } else if (req.user.role === 'admin' && req.query.all === 'true') {
    query = AgentConfig.find();
  } else {
    // Regular users can only see their own agents plus public agents
    query = AgentConfig.find({
      $or: [
        { user: req.user.id },
        { isPublic: true }
      ]
    });
  }
  
  // Add population for user details if admin
  if (req.user.role === 'admin') {
    query = query.populate({
      path: 'user',
      select: 'name email'
    });
  }
  
  const agents = await query;
  
  res.status(200).json({
    success: true,
    count: agents.length,
    data: agents
  });
});

// @desc    Get single agent
// @route   GET /api/agents/:id
// @access  Private
exports.getAgent = asyncHandler(async (req, res, next) => {
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user owns the agent or agent is public
  if (agent.user.toString() !== req.user.id && !agent.isPublic && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to access this agent`, 401));
  }
  
  res.status(200).json({
    success: true,
    data: agent
  });
});

// @desc    Update agent
// @route   PUT /api/agents/:id
// @access  Private
exports.updateAgent = asyncHandler(async (req, res, next) => {
  let agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user owns the agent
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to update this agent`, 401));
  }
  
  agent = await AgentConfig.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: agent
  });
});

// @desc    Delete agent
// @route   DELETE /api/agents/:id
// @access  Private
exports.deleteAgent = asyncHandler(async (req, res, next) => {
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user owns the agent
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to delete this agent`, 401));
  }
  
  await agent.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Train agent with RAG implementation
// @route   POST /api/agents/:id/train
// @access  Private
exports.trainAgent = asyncHandler(async (req, res, next) => {
  const { knowledgeSources } = req.body;
  
  if (!knowledgeSources || !Array.isArray(knowledgeSources)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Please provide knowledge sources array',
        statusCode: 400
      }
    });
  }

  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: {
        message: `Agent not found with id ${req.params.id}`,
        statusCode: 404
      }
    });
  }
  
  // Authorization check
  const isOwner = agent.user.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Not authorized to train this agent',
        statusCode: 403
      }
    });
  }

  try {
    // Process documents for RAG
    const documentSources = knowledgeSources.filter(
      source => source.sourceType === 'document' && source.sourceId
    );

    if (documentSources.length > 0) {
      // Get all documents
      const documents = await Document.find({
        _id: { $in: documentSources.map(source => source.sourceId) }
      });

      // Initialize knowledge base if it doesn't exist
      if (!agent.knowledgeBase) {
        agent.knowledgeBase = {
          documents: [],
          lastUpdated: Date.now()
        };
      }

      // Process each document
      for (const doc of documents) {
        // Split into smaller chunks (e.g., paragraphs)
        const chunks = await openaiService.createDocumentChunks(doc.content, {
          maxChunkSize: 500,
          overlap: 50
        });

        // Generate embeddings for each chunk
        const processedChunks = await Promise.all(
          chunks.map(async (chunk) => {
            const embedding = await openaiService.createEmbedding(chunk);
            return {
              text: chunk,
              embedding: embedding,
              sourceDoc: doc.title || doc._id.toString()
            };
          })
        );

        // Add to knowledge base
        agent.knowledgeBase.documents.push({
          documentId: doc._id,
          chunks: processedChunks
        });
      }

      agent.knowledgeBase.lastUpdated = Date.now();
    }

    await agent.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Agent successfully trained',
        documentsProcessed: documentSources.length
      }
    });

  } catch (error) {
    console.error('Training error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to train agent'
    });
  }
});

// @desc    Start conversation with agent
// @route   POST /api/agents/:id/converse
// @access  Private
exports.startConversation = asyncHandler(async (req, res, next) => {
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Check if user can access this agent (owner or public)
  if (agent.user.toString() !== req.user.id && !agent.isPublic && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to use this agent`, 401));
  }
  
  // Create a new conversation with this agent
  const conversation = await Conversation.create({
    title: `Conversation with ${agent.name}`,
    user: req.user.id,
    agentConfig: agent._id,
    messages: [{
      role: 'system',
      content: agent.generateCompleteSystemPrompt(),
      timestamp: Date.now()
    }]
  });
  
  res.status(201).json({
    success: true,
    data: conversation
  });
});

// @desc    Update agent embed settings
// @route   PUT /api/agents/:id/embed-settings
// @access  Private
exports.updateEmbedSettings = asyncHandler(async (req, res, next) => {
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user is agent owner
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to update this agent`, 401));
  }
  
  // Update embed settings
  agent.embedSettings = req.body.embedSettings;
  await agent.save();
  
  res.status(200).json({
    success: true,
    data: agent
  });
});

// @desc    Patch agent
// @route   PATCH /api/agents/:id
// @access  Private
exports.patchAgent = asyncHandler(async (req, res, next) => {
  let agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: {
        message: `Agent not found with id ${req.params.id}. Please verify the agent ID.`,
        statusCode: 404
      }
    });
  }

  // Authorization check
  const agentOwnerId = agent.user.toString();
  const requestUserId = req.user.id.toString();
  const isOwner = agentOwnerId === requestUserId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        message: `Access denied. This agent belongs to user ${agentOwnerId}. Please verify you are using the correct account or contact the agent owner.`,
        statusCode: 403
      }
    });
  }

  // Validate knowledge sources if provided
  if (req.body.knowledgeSources) {
    if (!Array.isArray(req.body.knowledgeSources)) {
      return next(
        new ErrorResponse(
          'Knowledge sources must be an array. Please provide a valid format.',
          400
        )
      );
    }

    // Validate document IDs
    const documentSources = req.body.knowledgeSources.filter(
      source => source.sourceType === 'document' && source.sourceId
    );
    
    if (documentSources.length > 0) {
      const documentIds = documentSources.map(source => source.sourceId);
      const foundDocs = await Document.countDocuments({ 
        _id: { $in: documentIds } 
      });
      
      if (foundDocs !== documentIds.length) {
        return next(
          new ErrorResponse(
            'One or more document IDs are invalid. Please verify all document IDs exist.',
            400
          )
        );
      }
    }
    
    // Validate website URLs
    const websiteSources = req.body.knowledgeSources.filter(
      source => source.sourceType === 'website' && source.url
    );
    
    for (const source of websiteSources) {
      if (!/^(http|https):\/\/[^ "]+$/.test(source.url)) {
        return next(
          new ErrorResponse(
            `Invalid URL format: ${source.url}. URLs must start with http:// or https://`,
            400
          )
        );
      }
    }
  }

  try {
    const updates = {};
    const allowedFields = [
      'name', 'description', 'systemPrompt', 'isPublic',
      'knowledgeSources', 'trainingData', 'embedSettings'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    agent = await AgentConfig.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: agent
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        message: `Failed to update agent: ${error.message}`,
        statusCode: 400
      }
    });
  }
});

// Export the getRelevantContext function
exports.getRelevantContext = asyncHandler(async (agentId, query) => {
  const agent = await AgentConfig.findById(agentId);
  if (!agent || !agent.knowledgeBase) return null;

  // Generate embedding for the query
  const queryEmbedding = await openaiService.createEmbedding(query);

  // Find most relevant chunks using cosine similarity
  const relevantChunks = agent.knowledgeBase.documents
    .flatMap(doc => doc.chunks)
    .map(chunk => ({
      text: chunk.text,
      similarity: calculateCosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3); // Get top 3 most relevant chunks

  return relevantChunks.map(chunk => chunk.text).join('\n\n');
});

// First, add this helper function for emotion analysis
const analyzeEmotion = (text) => {
  // Basic emotion indicators/keywords
  const emotionPatterns = {
    angry: /(angry|furious|upset|mad|terrible|awful|horrible|hate|frustrated|annoying|useless)/i,
    happy: /(happy|great|excellent|awesome|love|wonderful|fantastic|pleased|delighted|thank|perfect)/i,
    sad: /(sad|disappointed|unhappy|regret|sorry|unfortunately|miss|lost|failed|poor)/i,
    urgent: /(asap|urgent|emergency|quickly|immediate|fast|hurry|need|critical)/i,
    confused: /(confused|unclear|don't understand|what do you mean|doesn't make sense|how come|why)/i,
    curious: /(how|what|when|where|why|could you|can you|tell me|explain|curious)/i
  };

  // Check for multiple punctuation marks which might indicate emotional intensity
  const emphasisPatterns = {
    exclamation: /!{2,}/g,
    question: /\?{2,}/g,
    allCaps: /[A-Z]{3,}/g
  };

  // Initialize emotion scores
  let emotions = {
    angry: 0,
    happy: 0,
    sad: 0,
    urgent: 0,
    confused: 0,
    curious: 0,
    intensity: 0
  };

  // Check for emotion patterns
  Object.entries(emotionPatterns).forEach(([emotion, pattern]) => {
    const matches = (text.match(pattern) || []).length;
    emotions[emotion] = matches;
  });

  // Calculate intensity based on punctuation and formatting
  emotions.intensity = (
    ((text.match(emphasisPatterns.exclamation) || []).length) +
    ((text.match(emphasisPatterns.question) || []).length) +
    ((text.match(emphasisPatterns.allCaps) || []).length)
  );

  // Determine dominant emotion
  const dominantEmotion = Object.entries(emotions)
    .filter(([key]) => key !== 'intensity')
    .reduce((max, [emotion, score]) => 
      score > max.score ? {emotion, score} : max,
      {emotion: 'neutral', score: 0}
    );

  return {
    emotions,
    dominantEmotion: dominantEmotion.emotion,
    intensity: emotions.intensity
  };
};

// @desc    Get agent analytics
// @route   GET /api/agents/:id/analytics
// @access  Private
exports.getAgentAnalytics = asyncHandler(async (req, res, next) => {
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Check authorization
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to view this agent's analytics`, 401));
  }

  try {
    // Get all conversations for this agent
    const conversations = await Conversation.find({ agentConfig: agent._id });
    
    // Basic stats
    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, conv) => 
      sum + conv.messages.filter(msg => msg.role !== 'system').length, 0
    );

    // Calculate average messages per conversation
    const avgMessagesPerConversation = totalConversations > 0 
      ? (totalMessages / totalConversations).toFixed(2) 
      : 0;

    // Get conversation duration stats
    const durationStats = conversations.map(conv => {
      const messages = conv.messages.filter(msg => msg.role !== 'system');
      if (messages.length < 2) return 0;
      return new Date(messages[messages.length - 1].timestamp) - new Date(messages[0].timestamp);
    });

    const avgDuration = durationStats.length > 0 
      ? (durationStats.reduce((a, b) => a + b, 0) / durationStats.length / 1000).toFixed(2) 
      : 0;

    // Get user message patterns
    const userMessages = conversations.flatMap(conv => 
      conv.messages.filter(msg => msg.role === 'user')
    );

    // Analyze message lengths
    const messageLengths = userMessages.map(msg => msg.content.length);
    const avgMessageLength = messageLengths.length > 0 
      ? (messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length).toFixed(2) 
      : 0;

    // Time-based analytics
    const timeAnalytics = {
      hourly: Array(24).fill(0),
      daily: Array(7).fill(0),
      monthly: Array(12).fill(0)
    };

    conversations.forEach(conv => {
      const date = new Date(conv.createdAt);
      timeAnalytics.hourly[date.getHours()]++;
      timeAnalytics.daily[date.getDay()]++;
      timeAnalytics.monthly[date.getMonth()]++;
    });

    // Language detection (basic implementation)
    const languagePatterns = {
      english: /^[a-zA-Z\s.,!?]+$/,
      containsNonLatin: /[^\u0000-\u007F]/,
      containsCode: /(function|const|let|var|if|for|while|return|import|export|class)/
    };

    const languageStats = userMessages.reduce((stats, msg) => {
      if (languagePatterns.english.test(msg.content)) stats.english++;
      if (languagePatterns.containsNonLatin.test(msg.content)) stats.nonLatin++;
      if (languagePatterns.containsCode.test(msg.content)) stats.codeRelated++;
      return stats;
    }, { english: 0, nonLatin: 0, codeRelated: 0 });

    // Response time analytics
    const responseTimes = [];
    conversations.forEach(conv => {
      const messages = conv.messages.filter(msg => msg.role !== 'system');
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].role === 'assistant' && messages[i-1].role === 'user') {
          responseTimes.push(
            new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp)
          );
        }
      }
    });

    const avgResponseTime = responseTimes.length > 0 
      ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 1000).toFixed(2) 
      : 0;

    // Add emotion analysis
    const emotionAnalytics = {
      overall: {
        angry: 0,
        happy: 0,
        sad: 0,
        urgent: 0,
        confused: 0,
        curious: 0,
        neutral: 0
      },
      trends: {
        hourly: Array(24).fill().map(() => ({})),
        daily: Array(7).fill().map(() => ({})),
        monthly: Array(12).fill().map(() => ({}))
      },
      intensityDistribution: {
        low: 0,
        medium: 0,
        high: 0
      },
      emotionalConversations: []
    };

    // Analyze emotions in conversations
    conversations.forEach(conv => {
      const conversationEmotions = {
        conversationId: conv._id,
        timeline: [],
        overallMood: null,
        intensityScore: 0
      };

      const userMessages = conv.messages.filter(msg => msg.role === 'user');
      
      userMessages.forEach(msg => {
        const analysis = analyzeEmotion(msg.content);
        
        // Update overall stats
        emotionAnalytics.overall[analysis.dominantEmotion]++;
        
        // Track emotion timeline
        conversationEmotions.timeline.push({
          timestamp: msg.timestamp,
          emotion: analysis.dominantEmotion,
          intensity: analysis.intensity
        });

        // Update intensity distribution
        if (analysis.intensity <= 1) emotionAnalytics.intensityDistribution.low++;
        else if (analysis.intensity <= 3) emotionAnalytics.intensityDistribution.medium++;
        else emotionAnalytics.intensityDistribution.high++;

        // Update time-based trends
        const msgDate = new Date(msg.timestamp);
        const hour = msgDate.getHours();
        const day = msgDate.getDay();
        const month = msgDate.getMonth();

        emotionAnalytics.trends.hourly[hour][analysis.dominantEmotion] = 
          (emotionAnalytics.trends.hourly[hour][analysis.dominantEmotion] || 0) + 1;
        emotionAnalytics.trends.daily[day][analysis.dominantEmotion] = 
          (emotionAnalytics.trends.daily[day][analysis.dominantEmotion] || 0) + 1;
        emotionAnalytics.trends.monthly[month][analysis.dominantEmotion] = 
          (emotionAnalytics.trends.monthly[month][analysis.dominantEmotion] || 0) + 1;
      });

      // Calculate overall conversation mood
      if (conversationEmotions.timeline.length > 0) {
        const moodCounts = conversationEmotions.timeline.reduce((acc, item) => {
          acc[item.emotion] = (acc[item.emotion] || 0) + 1;
          return acc;
        }, {});

        conversationEmotions.overallMood = Object.entries(moodCounts)
          .reduce((a, b) => (moodCounts[a] > moodCounts[b] ? a : b))[0];
        
        conversationEmotions.intensityScore = 
          conversationEmotions.timeline.reduce((sum, item) => sum + item.intensity, 0) / 
          conversationEmotions.timeline.length;

        emotionAnalytics.emotionalConversations.push(conversationEmotions);
      }
    });

    // Add emotion analytics to the response
    res.status(200).json({
      success: true,
      data: {
        agentInfo: {
          name: agent.name,
          model: agent.model,
          expertise: agent.expertise,
          personality: agent.personality,
          isPublic: agent.isPublic,
          createdAt: agent.createdAt
        },
        conversationStats: {
          total: totalConversations,
          totalMessages,
          avgMessagesPerConversation: parseFloat(avgMessagesPerConversation),
          avgConversationDuration: parseFloat(avgDuration), // in seconds
          avgMessageLength: parseFloat(avgMessageLength), // in characters
          avgResponseTime: parseFloat(avgResponseTime) // in seconds
        },
        timeAnalytics: {
          hourlyDistribution: timeAnalytics.hourly,
          dailyDistribution: timeAnalytics.daily,
          monthlyDistribution: timeAnalytics.monthly
        },
        languageAnalysis: {
          english: languageStats.english,
          nonLatin: languageStats.nonLatin,
          codeRelated: languageStats.codeRelated,
          totalMessages: userMessages.length
        },
        knowledgeBaseStats: {
          documentCount: agent.knowledgeBase?.documents?.length || 0,
          lastUpdated: agent.knowledgeBase?.lastUpdated
        },
        emotionAnalytics: {
          overall: emotionAnalytics.overall,
          trends: emotionAnalytics.trends,
          intensityDistribution: emotionAnalytics.intensityDistribution,
          // Get top 5 most emotional conversations
          topEmotionalConversations: emotionAnalytics.emotionalConversations
            .sort((a, b) => b.intensityScore - a.intensityScore)
            .slice(0, 5)
            .map(conv => ({
              conversationId: conv.conversationId,
              overallMood: conv.overallMood,
              intensityScore: conv.intensityScore,
              emotionChanges: conv.timeline.length - 1
            })),
          emotionProgressions: emotionAnalytics.emotionalConversations
            .filter(conv => conv.timeline.length > 1)
            .map(conv => ({
              conversationId: conv.conversationId,
              startEmotion: conv.timeline[0].emotion,
              endEmotion: conv.timeline[conv.timeline.length - 1].emotion,
              improved: conv.timeline[0].emotion === 'angry' && 
                       conv.timeline[conv.timeline.length - 1].emotion === 'happy'
            }))
        }
      }
    });
  } catch (error) {
    return next(new ErrorResponse('Error generating analytics', 500));
  }
}); 