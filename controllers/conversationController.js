const Conversation = require('../models/Conversation');
const Document = require('../models/Document');
const openaiService = require('../services/openaiService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const AgentConfig = require('../models/AgentConfig');
const knowledgeSourceService = require('../services/knowledgeSourceService');

// @desc    Start a new conversation
// @route   POST /api/conversations
// @access  Public
exports.createConversation = asyncHandler(async (req, res, next) => {
  const { title, documentIds = [], language = 'en', userPreferences = {} } = req.body;

  // Validate document IDs if provided
  if (documentIds.length > 0) {
    const documents = await Document.find({ _id: { $in: documentIds } });
    if (documents.length !== documentIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more document IDs are invalid'
      });
    }
  }

  // Create a new conversation
  const conversation = await Conversation.create({
    title: title || 'New Conversation',
    documentIds,
    messages: [],
    language,
    userPreferences,
    analytics: {
      topicsSummary: [],
      sentimentScore: 0,
      interactionCount: 0
    }
  });

  res.status(201).json({
    success: true,
    data: conversation
  });
});

// @desc    Get all conversations
// @route   GET /api/conversations
// @access  Public
exports.getConversations = asyncHandler(async (req, res, next) => {
  const conversations = await Conversation.find().sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: conversations.length,
    data: conversations
  });
});

// @desc    Get a single conversation
// @route   GET /api/conversations/:id
// @access  Public
exports.getConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id).populate('documentIds');

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  res.status(200).json({
    success: true,
    data: conversation
  });
});

// @desc    Send a message in a conversation with document context
// @route   POST /api/conversations/:id/messages
// @access  Public
exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { message, includeDocuments = true } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a message'
    });
  }
  
  // Get conversation
  const conversation = await Conversation.findById(req.params.id);
  
  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }
  
  // Add user message to conversation
  conversation.messages.push({
    role: 'user',
    content: message,
    timestamp: Date.now(),
    language: conversation.language
  });
  
  // Increment interaction count
  conversation.analytics.interactionCount += 1;
  
  // Build context for AI response
  let context = '';
  if (includeDocuments && conversation.documentIds && conversation.documentIds.length > 0) {
    // Get document context based on query
    const relevantContext = await getRelevantDocumentContext(message, conversation.documentIds);
    if (relevantContext) {
      context = `The following information may be relevant to the question:\n\n${relevantContext}\n\n`;
    }
  }
  
  // Get AI response
  let aiResponse;
  try {
    // Get or create system prompt
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    if (conversation.agentConfig) {
      const agentConfig = await AgentConfig.findById(conversation.agentConfig);
      if (agentConfig) {
        systemPrompt = agentConfig.generateCompleteSystemPrompt();
      }
    }
    
    // Update system message with context if needed
    let messages = [...conversation.messages];
    
    // Add context to system message if available
    if (context) {
      const contextMessage = {
        role: 'system',
        content: `${systemPrompt}\n\n${context}`,
      };
      
      // Replace system message or add it if not present
      const sysIndex = messages.findIndex(m => m.role === 'system');
      if (sysIndex >= 0) {
        messages[sysIndex] = contextMessage;
      } else {
        messages = [contextMessage, ...messages];
      }
    }
    
    // Get AI response
    const responseData = await openaiService.getChatCompletion(messages);
    aiResponse = responseData.content;
    
    // Track AI usage
    const aiUsage = responseData.usage || null;
    
    // Add assistant response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: Date.now(),
      language: conversation.language
    });
    
    // Update sentiment score
    conversation.analytics.sentimentScore = await openaiService.analyzeSentiment(
      conversation.messages.slice(-5)
    );
    
    // Save conversation
    await conversation.save();
    
    res.status(200).json({
      success: true,
      data: {
        message: aiResponse,
        conversation: conversation,
        aiUsage // Include usage data for billing/tracking
      }
    });
  } catch (error) {
    console.error('Error getting AI response:', error);
    return res.status(500).json({
      success: false,
      error: 'Error generating AI response'
    });
  }
});

/**
 * Get relevant context from documents based on query
 * @param {string} query The user's query
 * @param {Array} documentIds Array of document IDs to search
 * @returns {Promise<string>} Relevant context text
 */
async function getRelevantDocumentContext(query, documentIds) {
  try {
    // Get documents
    const documents = await Document.find({ _id: { $in: documentIds } });
    if (!documents || documents.length === 0) return '';
    
    // Simple keyword matching for now (will be enhanced with embeddings later)
    const queryKeywords = query.toLowerCase()
      .match(/\b[a-z]{3,}\b/g) || [];
    
    let relevantChunks = [];
    
    // Find relevant chunks from each document
    for (const doc of documents) {
      if (!doc.chunks || doc.chunks.length === 0) {
        // Chunk the document if not already done
        await doc.chunkDocument();
      }
      
      // Score each chunk based on keyword matches
      for (const chunk of doc.chunks) {
        const chunkText = chunk.text.toLowerCase();
        let score = 0;
        
        queryKeywords.forEach(keyword => {
          if (chunkText.includes(keyword)) {
            score += 1;
          }
        });
        
        if (score > 0) {
          relevantChunks.push({
            text: chunk.text,
            score,
            docTitle: doc.fileName
          });
        }
      }
    }
    
    // Sort by relevance score and get top chunks
    relevantChunks.sort((a, b) => b.score - a.score);
    const topChunks = relevantChunks.slice(0, 3);
    
    // Combine context with document references
    return topChunks.map(chunk => 
      `From document "${chunk.docTitle}":\n${chunk.text}`
    ).join('\n\n');
  } catch (error) {
    console.error('Error getting document context:', error);
    return '';
  }
}

// @desc    Translate conversation to different language
// @route   POST /api/conversations/:id/translate
// @access  Public
exports.translateConversation = asyncHandler(async (req, res, next) => {
  const { targetLanguage } = req.body;

  if (!targetLanguage) {
    return res.status(400).json({
      success: false,
      error: 'Target language is required'
    });
  }

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  // Translate all messages
  const translatedMessages = await Promise.all(
    conversation.messages.map(async (message) => {
      const translatedContent = await openaiService.translateText(
        message.content,
        targetLanguage
      );
      return {
        ...message.toObject(),
        content: translatedContent,
        originalContent: message.content,
        language: targetLanguage
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      originalLanguage: conversation.language,
      targetLanguage,
      translatedMessages
    }
  });
});

// @desc    Get conversation analytics
// @route   GET /api/conversations/:id/analytics
// @access  Public
exports.getConversationAnalytics = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  // Generate or update analytics
  const analytics = {
    ...conversation.analytics,
    messageCount: conversation.messages.length,
    averageResponseTime: await openaiService.calculateResponseTimes(conversation.messages),
    topKeywords: await openaiService.extractKeywords(conversation.messages),
    sentimentTrend: await openaiService.analyzeSentimentTrend(conversation.messages)
  };

  res.status(200).json({
    success: true,
    data: analytics
  });
});

// @desc    Delete a conversation
// @route   DELETE /api/conversations/:id
// @access  Public
exports.deleteConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  await conversation.deleteOne(); // Updated from remove() which is deprecated

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Send message to agent conversation
// @route   POST /api/conversations/:id/agent-messages
// @access  Private
exports.sendAgentMessage = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  
  if (!content) {
    return next(new ErrorResponse('Please provide a message', 400));
  }
  
  // Find conversation
  const conversation = await Conversation.findById(req.params.id);
  
  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }
  
  // Check if this is an agent conversation
  if (!conversation.agentConfig) {
    return next(new ErrorResponse('This is not an agent conversation', 400));
  }
  
  // Get the agent configuration
  const agentConfig = await AgentConfig.findById(conversation.agentConfig);
  
  if (!agentConfig) {
    return next(new ErrorResponse('Agent configuration not found', 404));
  }
  
  // Add user message to conversation
  const userMessage = {
    role: 'user',
    content,
    timestamp: Date.now()
  };
  
  conversation.messages.push(userMessage);
  
  // Get recent messages (limit context window)
  const maxMessages = 10;
  const recentMessages = conversation.messages.slice(-maxMessages);
  
  // Gather context from knowledge sources if any
  let contextualInfo = '';
  
  if (agentConfig.knowledgeSources && agentConfig.knowledgeSources.length > 0) {
    contextualInfo = await knowledgeSourceService.getRelevantContext(content, agentConfig.knowledgeSources);
  } else if (agentConfig.allowedDocuments && agentConfig.allowedDocuments.length > 0) {
    // Backward compatibility with allowedDocuments
    const documents = await Document.find({
      _id: { $in: agentConfig.allowedDocuments },
      user: { $in: [req.user.id, agentConfig.user] }
    });
    
    if (documents.length > 0) {
      contextualInfo = documents.map(doc => `DOCUMENT: ${doc.title}\n${doc.content}`).join('\n\n');
    }
  }
  
  // Generate AI response using the agent configuration
  const response = await openaiService.generateAgentResponse({
    agentConfig,
    messages: recentMessages,
    contextualInfo
  });
  
  // Add AI response to conversation
  const assistantMessage = {
    role: 'assistant',
    content: response.choices[0].message.content,
    timestamp: Date.now()
  };
  
  conversation.messages.push(assistantMessage);
  
  // Update conversation analytics
  conversation.analytics = conversation.analytics || {};
  conversation.analytics.interactionCount = (conversation.analytics.interactionCount || 0) + 1;
  
  // Save updated conversation
  await conversation.save();
  
  // Return response with the AI message and usage data for logging
  return res.status(200).json({
    success: true,
    data: assistantMessage,
    aiUsage: response.usageData
  });
}); 