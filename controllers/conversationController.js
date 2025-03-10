const Conversation = require('../models/Conversation');
const Document = require('../models/Document');
const openaiService = require('../services/openaiService');
const asyncHandler = require('../middleware/async');

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

// @desc    Send a message to the conversation
// @route   POST /api/conversations/:id/messages
// @access  Public
exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { content, tonePreference } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Message content is required'
    });
  }

  // Find conversation by ID
  const conversation = await Conversation.findById(req.params.id).populate('documentIds');

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  // Initialize analytics if it doesn't exist
  if (!conversation.analytics) {
    conversation.analytics = {
      interactionCount: 0,
      topicsSummary: [],
      sentimentScore: 0
    };
  }

  // Auto-detect language if this is the first message or language is not set
  if (!conversation.language || conversation.messages.length === 0) {
    const detectedLanguage = await openaiService.detectLanguage(content);
    conversation.language = detectedLanguage;
  }

  // Update tone preference if provided
  if (tonePreference) {
    if (!conversation.userPreferences) conversation.userPreferences = {};
    conversation.userPreferences.tone = tonePreference;
  }

  // Analyze user's message tone if no explicit preference
  if (!conversation.userPreferences?.tone) {
    const detectedTone = await openaiService.analyzeTone(content);
    if (!conversation.userPreferences) conversation.userPreferences = {};
    conversation.userPreferences.tone = detectedTone;
  }

  // Add user message to conversation
  const userMessage = {
    role: 'user',
    content,
    timestamp: Date.now(),
    language: conversation.language
  };

  conversation.messages.push(userMessage);
  
  // Extract relevant content from documents (RAG)
  let contextualInfo = '';
  if (conversation.documentIds && conversation.documentIds.length > 0) {
    contextualInfo = await openaiService.retrieveRelevantContexts(
      content,
      conversation.documentIds,
      conversation.messages
    );
  }

  // Generate AI response using OpenAI with advanced context
  const response = await openaiService.generateResponse({
    messages: conversation.messages,
    contextualInfo,
    language: conversation.language,
    userPreferences: conversation.userPreferences
  });

  // Add AI response to conversation
  const assistantMessage = {
    role: 'assistant',
    content: response.choices[0].message.content,
    timestamp: Date.now(),
    language: conversation.language
  };

  conversation.messages.push(assistantMessage);
  
  // Update conversation analytics
  conversation.analytics.interactionCount += 1;
  
  // Generate conversation summary if enough messages
  if (conversation.messages.length % 5 === 0) {
    try {
      const summary = await openaiService.summarizeConversation(conversation.messages);
      conversation.summary = summary;
      
      const topics = await openaiService.extractTopics(conversation.messages);
      conversation.analytics.topicsSummary = topics;
      
      const sentimentScore = await openaiService.analyzeSentiment(conversation.messages);
      conversation.analytics.sentimentScore = sentimentScore;
    } catch (error) {
      console.error('Error generating conversation analysis:', error);
    }
  }
  
  // Save updated conversation
  await conversation.save();

  // Generate follow-up suggestions (but don't wait for them to complete the request)
  let followUpSuggestions = [];
  try {
    followUpSuggestions = await openaiService.generateFollowUps(
      conversation.messages,
      conversation.analytics.topicsSummary || []
    );
  } catch (error) {
    console.error('Error generating follow-up suggestions:', error);
  }

  res.status(200).json({
    success: true,
    data: {
      conversation,
      assistantResponse: assistantMessage,
      followUpSuggestions
    }
  });
});

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