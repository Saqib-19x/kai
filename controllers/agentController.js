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
    return res.status(400).json({
      success: false,
      error: {
        message: 'Please provide a name for the agent',
        statusCode: 400
      }
    });
  }

  // Add user to request body
  req.body.user = req.user.id;
  
  // Check if user is allowed to create more agents (limit to 5 for non-admin)
  if (req.user.role !== 'admin') {
    const agentsCount = await AgentConfig.countDocuments({ user: req.user.id });
    if (agentsCount >= 5) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'You have reached the maximum number of agents (5)',
          statusCode: 400
        }
      });
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
    trainingData: null,
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

  // Handle field selection through select parameter
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Add population for user details if requested or if admin
  if (req.query.populate === 'user' || req.user.role === 'admin') {
    query = query.populate({
      path: 'user',
      select: 'name email'
    });
  }

  // Add population for knowledge sources if requested
  if (req.query.populate === 'knowledge' || req.query.populate === 'all') {
    query = query.populate('knowledgeSources');
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
  // First validate if the ID is a valid MongoDB ObjectId
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Invalid agent ID format: ${req.params.id}`,
        statusCode: 400
      }
    });
  }

  let query = AgentConfig.findById(req.params.id);
  
  // Always populate the user field for authorization check
  query = query.populate('user', 'id');
  
  // Handle field selection if select parameter is provided
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  try {
    const agent = await query;
  
  if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Agent not found with id of ${req.params.id}`,
          statusCode: 404
        }
      });
  }
  
  // Make sure user owns the agent or agent is public
    if (agent.user._id.toString() !== req.user.id && !agent.isPublic && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'User not authorized to access this agent',
          statusCode: 403
        }
      });
    }
    
    // If we're using field selection, ensure we don't expose user details
    const responseData = agent.toObject();
    if (req.query.select && !req.query.select.includes('user')) {
      delete responseData.user;
    }
    
    return res.status(200).json({
    success: true,
      data: responseData
    });

  } catch (error) {
    // Explicitly handle any other errors with JSON response
    return res.status(500).json({
      success: false,
      error: {
        message: `Error retrieving agent: ${error.message}`,
        statusCode: 500
      }
    });
  }
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
  const { message } = req.body;
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Check if user can access this agent (owner or public)
  if (agent.user.toString() !== req.user.id && !agent.isPublic && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to use this agent`, 401));
  }

  try {
    // Generate title from the first message or use a default
    const title = message 
      ? (message.length > 30 ? `${message.substring(0, 30)}...` : message)
      : `Conversation with ${agent.name}`;
    
    // Prepare system message with complete prompt
    const systemMessage = {
      role: 'system',
      content: agent.systemPrompt || 'You are a helpful AI assistant.',
      timestamp: Date.now()
    };
    
    // Initialize conversation with system message
    const conversation = new Conversation({
      title: title,
      user: req.user.id,
      agentConfig: agent._id,
      messages: [systemMessage],
      analytics: {
        startTime: Date.now(),
        messageCount: 1,  // Count only the system message for now
        lastInteraction: Date.now()
      }
    });
    
    // If there's an initial message, process it and add AI response
    if (message) {
      // Get relevant context from knowledge base if available
      let contextualPrompt = systemMessage.content;
      
      if (agent.knowledgeBase && agent.knowledgeBase.documents && agent.knowledgeBase.documents.length > 0) {
        const relevantContext = await exports.getRelevantContext(agent._id, message);
        
        if (relevantContext) {
          contextualPrompt += `\n\nContext information for this query:\n${relevantContext}`;
        }
      }
      
      // Add user message to conversation
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });
      
      conversation.analytics.messageCount++;
      
      // Get AI response
      const messages = [
        { role: 'system', content: contextualPrompt },
        { role: 'user', content: message }
      ];
      
      const response = await openaiService.createChatCompletion({
        model: agent.model || 'gpt-3.5-turbo',
        messages,
        temperature: agent.temperature || 0.7,
        max_tokens: agent.maxTokens || 1000
      });
      
      if (response && response.choices && response.choices.length > 0) {
        // Add AI response to conversation
        conversation.messages.push({
          role: 'assistant',
          content: response.choices[0].message.content,
          timestamp: Date.now()
        });
        
        conversation.analytics.messageCount++;
      }
    }
    
    // Save conversation
    await conversation.save();
    
    // Format the response
    const formattedResponse = {
      success: true,
      data: {
        conversation: {
          id: conversation._id,
          title: conversation.title,
          agent: {
            id: agent._id,
            name: agent.name,
            model: agent.model,
            expertise: agent.expertise || []
          },
          messages: conversation.messages
            .filter(msg => msg.role !== 'system') // Exclude system message from client response
            .map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp
            })),
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        }
      }
    };
    
    res.status(201).json(formattedResponse);
    
  } catch (error) {
    console.error('Error starting conversation:', error);
    return next(new ErrorResponse(`Failed to start conversation: ${error.message}`, 500));
  }
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

// Add this helper function before the getRelevantContext function
/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vecA - First vector
 * @param {Array} vecB - Second vector
 * @returns {number} - Cosine similarity score between 0 and 1
 */
const calculateCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    console.error('Invalid vectors provided for similarity calculation');
    return 0;
  }
  
  try {
    // Calculate dot product
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    
    // Calculate magnitudes
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    
    // Calculate cosine similarity
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  } catch (error) {
    console.error('Error calculating cosine similarity:', error);
    return 0;
  }
};

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
    return res.status(404).json({
      success: false,
      error: {
        message: `Agent not found with id of ${req.params.id}`,
        statusCode: 404
      }
    });
  }
  
  // Check authorization
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        message: 'User not authorized to view this agent\'s analytics',
        statusCode: 403
      }
    });
  }

  try {
    const conversations = await Conversation.find({ agentConfig: agent._id });
    const timeRange = req.query.timeRange || '30d';
    const endDate = new Date();
    const startDate = getStartDate(timeRange);

    // Filter conversations by time range for dashboard metrics
    const filteredConversations = conversations.filter(conv => 
      new Date(conv.createdAt) >= startDate && new Date(conv.createdAt) <= endDate
    );

    // Overview metrics (from the original implementation)
    const overview = {
      totalConversations: conversations.length,
      activeUsers: new Set(conversations.map(conv => conv.user.toString())).size,
      avgResponseTime: calculateAvgResponseTime(conversations),
      conversionRate: calculateConversionRate(conversations)
    };

    // Existing detailed analytics
    const existingAnalytics = {
      agentInfo: {
        name: agent.name,
        model: agent.model,
        expertise: agent.expertise,
        personality: agent.personality,
        isPublic: agent.isPublic,
        createdAt: agent.createdAt
      },
      overview, // Add overview metrics here
      conversationStats: {
        total: conversations.length,
        totalMessages: calculateTotalMessages(conversations),
        avgMessagesPerConversation: calculateAvgMessages(conversations),
        avgDuration: calculateAvgDuration(conversations),
        avgMessageLength: calculateAvgMessageLength(conversations),
        avgResponseTime: calculateAvgResponseTime(conversations)
      },
      timeAnalytics: getTimeAnalytics(conversations),
      languageAnalysis: getLanguageAnalysis(conversations),
      emotionAnalytics: getEmotionAnalytics(conversations),
      knowledgeBaseStats: {
        documentCount: agent.knowledgeBase?.documents?.length || 0,
        lastUpdated: agent.knowledgeBase?.lastUpdated
      }
    };

    // New dashboard analytics
    const dashboardAnalytics = {
      engagementOverview: getEngagementData(filteredConversations, timeRange),
      responseAnalysis: getResponseAnalysis(filteredConversations),
      recentConversations: getRecentConversations(filteredConversations),
      sentimentAnalysis: getSentimentAnalysis(filteredConversations, timeRange)
    };

    // Get requested fields from query params or body
    let requestedFields = [];
    if (req.query.fields) {
      requestedFields = req.query.fields.split(',').map(field => field.trim());
    } else if (req.body.fields && Array.isArray(req.body.fields)) {
      requestedFields = req.body.fields;
    }

    // Combine all analytics
    const allAnalytics = {
      ...existingAnalytics,
      dashboard: dashboardAnalytics
    };

    // If specific fields were requested, filter the response
    const responseData = requestedFields.length > 0
      ? filterRequestedFields(allAnalytics, requestedFields)
      : allAnalytics;

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: `Error generating analytics: ${error.message}`,
        statusCode: 500
      }
    });
  }
});

// Helper function to filter requested fields
const filterRequestedFields = (analytics, fields) => {
  const filtered = {};
  fields.forEach(field => {
    if (field in analytics) {
      filtered[field] = analytics[field];
    }
  });
  return filtered;
};

// Helper function to get start date based on time range
const getStartDate = (timeRange) => {
  const now = new Date();
  switch (timeRange) {
    case '24h': return new Date(now - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now - 90 * 24 * 60 * 60 * 1000);
    default: return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
};

// Dashboard helper functions
const getResponseTimeDistribution = (responseTimes) => {
  const distribution = [0, 0, 0, 0, 0]; // [<1s, 1-5s, 5-10s, 10-30s, >30s]
  
  responseTimes.forEach(time => {
    const seconds = time / 1000;
    if (seconds < 1) distribution[0]++;
    else if (seconds < 5) distribution[1]++;
    else if (seconds < 10) distribution[2]++;
    else if (seconds < 30) distribution[3]++;
    else distribution[4]++;
  });

  return distribution;
};

const getResponseTimeTimeSeries = (conversations) => {
  const timeSeriesData = [];
  
  conversations.forEach(conv => {
    const messages = conv.messages;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i-1].role === 'user') {
        const responseTime = new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp);
        timeSeriesData.push({
          timestamp: messages[i].timestamp,
          responseTime: responseTime / 1000 // Convert to seconds
        });
      }
    }
  });

  // Sort by timestamp
  return timeSeriesData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const getEngagementData = (conversations, timeRange) => {
  const timeIntervals = getTimeIntervals(timeRange);
  
  // Initialize data points for the chart
  const chartData = timeIntervals.map(interval => ({
    timestamp: interval,
    conversationCount: 0,
    messageCount: 0,
    uniqueUsers: new Set()
  }));

  // Populate data points
  conversations.forEach(conv => {
    const convDate = new Date(conv.createdAt);
    const intervalIndex = findIntervalIndex(convDate, timeIntervals);
    if (intervalIndex !== -1) {
      chartData[intervalIndex].conversationCount++;
      chartData[intervalIndex].messageCount += conv.messages.length;
      chartData[intervalIndex].uniqueUsers.add(conv.user.toString());
    }
  });

  // Format for response
  return {
    hasData: conversations.length > 0,
    timeRange,
    chartData: chartData.map(point => ({
      timestamp: point.timestamp,
      conversationCount: point.conversationCount,
      messageCount: point.messageCount,
      uniqueUsers: point.uniqueUsers.size
    })),
    summary: {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((sum, conv) => sum + conv.messages.length, 0),
      totalUniqueUsers: new Set(conversations.map(conv => conv.user.toString())).size
    }
  };
};

const getTimeIntervals = (timeRange) => {
  const intervals = [];
  const now = new Date();
  const intervalSize = timeRange === '24h' ? 3600000 : // 1 hour
                      timeRange === '7d' ? 86400000 : // 1 day
                      timeRange === '30d' ? 86400000 : // 1 day
                      7200000; // 2 hours default

  for (let time = getStartDate(timeRange); time <= now; time = new Date(time.getTime() + intervalSize)) {
    intervals.push(new Date(time));
  }
  return intervals;
};

const findIntervalIndex = (date, intervals) => {
  for (let i = 0; i < intervals.length - 1; i++) {
    if (date >= intervals[i] && date < intervals[i + 1]) {
      return i;
    }
  }
  return intervals.length - 1;
};

const getResponseAnalysis = (conversations) => {
  const responseTimes = [];
  conversations.forEach(conv => {
    const messages = conv.messages;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i-1].role === 'user') {
        responseTimes.push(
          new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp)
        );
      }
    }
  });

  return {
    hasData: responseTimes.length > 0,
    averageResponseTime: responseTimes.length ? 
      Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 1000) : 0,
    responseTimeDistribution: {
      labels: ['<1s', '1-5s', '5-10s', '10-30s', '>30s'],
      data: getResponseTimeDistribution(responseTimes)
    },
    timeSeriesData: getResponseTimeTimeSeries(conversations)
  };
};

const getRecentConversations = (conversations) => {
  return {
    hasData: conversations.length > 0,
    conversations: conversations
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(conv => ({
        id: conv._id,
        title: conv.title || `Conversation ${conv._id}`,
        timestamp: conv.createdAt,
        messageCount: conv.messages.length,
        duration: conv.messages.length > 1 ? 
          new Date(conv.messages[conv.messages.length - 1].timestamp) - 
          new Date(conv.messages[0].timestamp) : 0,
        sentiment: analyzeSentiment(conv.messages)
      }))
  };
};

const getSentimentAnalysis = (conversations, timeRange) => {
  const timeIntervals = getTimeIntervals(timeRange);
  const sentimentData = timeIntervals.map(interval => ({
    timestamp: interval,
    positive: 0,
    neutral: 0,
    negative: 0
  }));

  conversations.forEach(conv => {
    const sentiment = analyzeSentiment(conv.messages);
    const intervalIndex = findIntervalIndex(new Date(conv.createdAt), timeIntervals);
    if (intervalIndex !== -1) {
      sentimentData[intervalIndex][sentiment]++;
    }
  });

  return {
    hasData: conversations.length > 0,
    timeRange,
    sentimentTrend: sentimentData,
    overall: {
      positive: sentimentData.reduce((sum, point) => sum + point.positive, 0),
      neutral: sentimentData.reduce((sum, point) => sum + point.neutral, 0),
      negative: sentimentData.reduce((sum, point) => sum + point.negative, 0)
    }
  };
};

const analyzeSentiment = (messages) => {
  const userMessages = messages.filter(msg => msg.role === 'user');
  let positiveCount = 0;
  let negativeCount = 0;

  const positiveWords = /\b(good|great|excellent|amazing|thank|happy|helpful|perfect|love)\b/i;
  const negativeWords = /\b(bad|poor|terrible|awful|unhappy|wrong|hate|confused|difficult)\b/i;

  userMessages.forEach(msg => {
    if (positiveWords.test(msg.content)) positiveCount++;
    if (negativeWords.test(msg.content)) negativeCount++;
  });

  return positiveCount > negativeCount ? 'positive' :
         negativeCount > positiveCount ? 'negative' : 'neutral';
};

// Helper functions for existing analytics calculations
const calculateTotalMessages = (conversations) => {
  return conversations.reduce((sum, conv) => 
      sum + conv.messages.filter(msg => msg.role !== 'system').length, 0
    );
};

const calculateAvgMessages = (conversations) => {
  const totalMessages = calculateTotalMessages(conversations);
  return conversations.length > 0 
    ? (totalMessages / conversations.length).toFixed(2)
    : 0;
};

const calculateAvgDuration = (conversations) => {
  const durations = conversations.map(conv => {
      const messages = conv.messages.filter(msg => msg.role !== 'system');
      if (messages.length < 2) return 0;
      return new Date(messages[messages.length - 1].timestamp) - new Date(messages[0].timestamp);
    });

  return durations.length > 0
    ? (durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(2)
      : 0;
};

const calculateAvgMessageLength = (conversations) => {
    const userMessages = conversations.flatMap(conv => 
      conv.messages.filter(msg => msg.role === 'user')
    );

    const messageLengths = userMessages.map(msg => msg.content.length);
  return messageLengths.length > 0
      ? (messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length).toFixed(2) 
      : 0;
};

const calculateAvgResponseTime = (conversations) => {
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
  
  return responseTimes.length > 0 
    ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 1000).toFixed(2)
    : 0;
};

const getTimeAnalytics = (conversations) => {
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

  return timeAnalytics;
};

const getLanguageAnalysis = (conversations) => {
  const userMessages = conversations.flatMap(conv => 
    conv.messages.filter(msg => msg.role === 'user')
  );

    const languagePatterns = {
      english: /^[a-zA-Z\s.,!?]+$/,
      containsNonLatin: /[^\u0000-\u007F]/,
      containsCode: /(function|const|let|var|if|for|while|return|import|export|class)/
    };

  return userMessages.reduce((stats, msg) => {
      if (languagePatterns.english.test(msg.content)) stats.english++;
      if (languagePatterns.containsNonLatin.test(msg.content)) stats.nonLatin++;
      if (languagePatterns.containsCode.test(msg.content)) stats.codeRelated++;
      return stats;
  }, { 
    english: 0, 
    nonLatin: 0, 
    codeRelated: 0,
    totalMessages: userMessages.length 
  });
};

const getEmotionAnalytics = (conversations) => {
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
    }
    };

    conversations.forEach(conv => {
      const userMessages = conv.messages.filter(msg => msg.role === 'user');
      userMessages.forEach(msg => {
        const analysis = analyzeEmotion(msg.content);
        emotionAnalytics.overall[analysis.dominantEmotion]++;
        
        if (analysis.intensity <= 1) emotionAnalytics.intensityDistribution.low++;
        else if (analysis.intensity <= 3) emotionAnalytics.intensityDistribution.medium++;
        else emotionAnalytics.intensityDistribution.high++;

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
  });

  return emotionAnalytics;
};

// Add this with the other helper functions
const calculateConversionRate = (conversations, options = {}) => {
  if (!conversations.length) return 0;

  const {
    minMessages = 5,
    minDurationMs = 2 * 60 * 1000, // 2 minutes
    requirePositiveSentiment = true
  } = options;

  const convertedConversations = conversations.filter(conv => {
    // Message count criterion
    const messageCount = conv.messages.filter(msg => msg.role !== 'system').length;
    if (messageCount >= minMessages) return true;

    // Duration criterion
    const duration = conv.messages.length > 1 ? 
      new Date(conv.messages[conv.messages.length - 1].timestamp) - 
      new Date(conv.messages[0].timestamp) : 0;
    if (duration >= minDurationMs) return true;

    // Sentiment criterion
    if (requirePositiveSentiment) {
      const userMessages = conv.messages.filter(msg => msg.role === 'user');
      if (userMessages.length) {
        const lastUserMessage = userMessages[userMessages.length - 1].content;
        const positiveWords = /\b(good|great|excellent|amazing|thank|happy|helpful|perfect|love)\b/i;
        if (positiveWords.test(lastUserMessage)) return true;
      }
    }

    return false;
  });

  const conversionRate = (convertedConversations.length / conversations.length) * 100;
  return parseFloat(conversionRate.toFixed(1));
}; 