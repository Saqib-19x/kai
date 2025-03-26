const Conversation = require('../models/Conversation');
const AgentConfig = require('../models/AgentConfig');
const Document = require('../models/Document');
const openaiService = require('../services/openaiService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const { calculateCosineSimilarity } = require('../utils/vectorUtils');
const mongoose = require('mongoose');
const { getRelevantContext } = require('./agentController');

// @desc    Start chat with AI agent
// @route   POST /api/conversations/start
// @access  Private
exports.startChat = asyncHandler(async (req, res) => {
  const { agentId, message } = req.body;

  if (!agentId || !message) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both agentId and initial message'
    });
  }

  try {
    // Find the AI agent with all necessary data
    const agent = await AgentConfig.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Get relevant context from knowledge base
    const relevantContext = await getRelevantContext(agentId, message);
    
    // Get documents content
    const documents = await Document.find({
      $or: [
        { _id: { $in: agent.allowedDocuments || [] } },
        { agent: agentId }
      ]
    }).select('originalName fileName extractedText fileType');

    console.log('Found documents:', documents.length);

    let documentContent = '';
    if (documents && documents.length > 0) {
      documentContent = documents.map(doc => `
Document: ${doc.originalName || doc.fileName}
Content:
${doc.extractedText || 'No content available'}
-------------------
`).join('\n');
    }

    // Create system message with both document content and relevant context
    const systemMessage = {
      role: 'system',
      content: `You are ${agent.name}, an AI assistant. ${agent.systemPrompt || ''}

${documentContent ? `Available Documents:\n${documentContent}\n` : ''}
${relevantContext ? `Most Relevant Context:\n${relevantContext}\n` : ''}

Instructions:
1. Use the information from these documents and relevant context to answer questions
2. When referencing information, mention which document it's from
3. If the information isn't in the documents or context, say "I don't have that information in my knowledge base"
4. Be precise and accurate with the information provided
`
    };

    // Get AI response
    const response = await openaiService.generateAgentResponse({
      agentConfig: agent,
      messages: [
        systemMessage,
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      maxTokens: 1000
    });

    // Generate a short title from the first message
    const chatTitle = generateChatTitle(message);

    // Create conversation with auto-generated title
    const conversation = new Conversation({
      user: req.user.id,
      agentConfig: agent._id,
      title: chatTitle,
      messages: [
        systemMessage,
        {
          role: 'user',
          content: message,
          timestamp: Date.now()
        },
        {
          role: 'assistant',
          content: response.choices[0].message.content,
          timestamp: Date.now()
        }
      ],
      analytics: {
        startTime: Date.now(),
        messageCount: 3,
        lastInteraction: Date.now()
      }
    });

    await conversation.save();

    // Debug log
    console.log('Documents available:', Boolean(documentContent));
    console.log('Document count:', documents.length);

    res.status(201).json({
      success: true,
      data: {
        conversationId: conversation._id,
        messages: conversation.messages.filter(m => m.role !== 'system'),
        agent: {
          id: agent._id,
          name: agent.name,
          expertise: agent.expertise,
          hasKnowledgeBase: Boolean(documentContent),
          documentCount: documents.length
        }
      }
    });

  } catch (error) {
    console.error('Error in startChat:', error);
    return res.status(500).json({
      success: false,
      error: 'Error starting conversation',
      details: error.message
    });
  }
});

// @desc    Send message in conversation
// @route   POST /api/conversations/:conversationId/message
// @access  Private
exports.sendMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const { conversationId } = req.params;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a message'
    });
  }

  // Validate conversationId format
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid conversation ID format'
    });
  }

  // Find conversation with populated agent config
  const conversation = await Conversation.findOne({
    _id: conversationId,
    user: req.user.id
  }).populate({
    path: 'agentConfig',
    populate: {
      path: 'allowedDocuments'
    }
  });

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  try {
    // Get relevant context for the new message
    const relevantContext = await getRelevantContext(conversation.agentConfig._id, message);

    // If this is the first real message (excluding system messages), update the title
    const userMessages = conversation.messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) {
      conversation.title = generateChatTitle(message);
    }

    // Get documents content
    const documents = await Document.find({
      $or: [
        { _id: { $in: conversation.agentConfig.allowedDocuments || [] } },
        { agent: conversation.agentConfig._id }
      ]
    });

    let documentContent = '';
    if (documents && documents.length > 0) {
      documentContent = documents.map(doc => `
Document: ${doc.originalName || doc.fileName}
Content:
${doc.extractedText || 'No content available'}
-------------------
`).join('\n');
    }

    // Get recent conversation history
    const recentMessages = conversation.messages
      .filter(m => m.role !== 'system')
      .slice(-5);

    // Create system message with context
    const systemMessage = {
      role: 'system',
      content: `${conversation.agentConfig.generateCompleteSystemPrompt()}
        
        ${relevantContext ? `Relevant Context:\n${relevantContext}\n` : ''}
        
        Previous conversation context:
        ${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
        
        Remember to only respond based on provided knowledge and stay in character.`
    };

    // Get AI response
    const response = await openaiService.generateAgentResponse({
      agentConfig: conversation.agentConfig,
      messages: [
        systemMessage,
        ...recentMessages,
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      maxTokens: 1000
    });

    // Add messages to conversation
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    conversation.messages.push({
      role: 'assistant',
      content: response.choices[0].message.content,
      timestamp: Date.now()
    });

    // Update analytics
    conversation.analytics = conversation.analytics || {};
    conversation.analytics.messageCount = (conversation.analytics.messageCount || 0) + 2;
    conversation.analytics.lastInteraction = Date.now();

    await conversation.save();

    res.status(200).json({
      success: true,
      data: {
        message: response.choices[0].message.content,
        conversation: conversation._id,
        title: conversation.title
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      error: 'Error processing message'
    });
  }
});

// @desc    Get chat history (brief)
// @route   GET /api/conversations
// @access  Private
exports.getChatHistory = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ user: req.user.id })
    .select('title createdAt updatedAt agentConfig')
    .populate('agentConfig', 'name')
    .sort({ updatedAt: -1 });

  const briefHistory = conversations.map(conv => ({
    id: conv._id,
    title: conv.title,
    agentName: conv.agentConfig?.name || 'Unknown Agent',
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt
  }));

  res.status(200).json({
    success: true,
    count: conversations.length,
    data: briefHistory
  });
});

// @desc    Get detailed chat
// @route   GET /api/conversations/:conversationId
// @access  Private
exports.getChatDetail = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // Validate conversation ID format
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid conversation ID format'
    });
  }

  // Find conversation with populated agent config and documents
  const conversation = await Conversation.findOne({
    _id: conversationId,
    user: req.user.id
  }).populate({
    path: 'agentConfig',
    select: 'name description expertise personality',
    populate: {
      path: 'allowedDocuments',
      select: 'fileName originalName'
    }
  });

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  // Format the response
  const formattedResponse = {
    success: true,
    data: {
      id: conversation._id,
      title: conversation.title,
      agent: {
        id: conversation.agentConfig?._id,
        name: conversation.agentConfig?.name,
        expertise: conversation.agentConfig?.expertise || []
      },
      messages: conversation.messages
        .filter(msg => msg.role !== 'system') // Exclude system messages
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      analytics: conversation.analytics || {}
    }
  };

  res.status(200).json(formattedResponse);
});

// @desc    Get conversation analytics
// @route   GET /api/conversations/:id/analytics
// @access  Private
exports.getAnalytics = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  // Calculate additional analytics
  const analytics = {
    ...conversation.analytics,
    duration: Date.now() - conversation.analytics.startTime,
    averageResponseTime: calculateAverageResponseTime(conversation.messages),
    messageDistribution: {
      user: conversation.messages.filter(m => m.role === 'user').length,
      assistant: conversation.messages.filter(m => m.role === 'assistant').length
    },
    topKeywords: await extractKeywords(conversation.messages)
  };

  res.status(200).json({
    success: true,
    data: analytics
  });
});

// @desc    Delete a chat
// @route   DELETE /api/conversations/:conversationId
// @access  Private
exports.deleteChat = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // Validate conversation ID format
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid conversation ID format'
    });
  }

  try {
    // Find conversation and ensure it belongs to the user
    const conversation = await Conversation.findOne({
      _id: conversationId,
      user: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found or you do not have permission to delete it'
      });
    }

    // Delete the conversation
    await Conversation.findByIdAndDelete(conversationId);

    res.status(200).json({
      success: true,
      data: {
        message: 'Conversation deleted successfully',
        deletedId: conversationId
      }
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({
      success: false,
      error: 'Error deleting conversation'
    });
  }
});

// Helper functions for analytics
function calculateAverageResponseTime(messages) {
  let totalTime = 0;
  let responseCount = 0;

  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      totalTime += messages[i].timestamp - messages[i-1].timestamp;
      responseCount++;
    }
  }

  return responseCount > 0 ? Math.round(totalTime / responseCount) : 0;
}

async function extractKeywords(messages) {
  const text = messages.map(m => m.content).join(' ');
  // Implement keyword extraction logic here (you can use OpenAI or other NLP services)
  // This is a placeholder implementation
  return ['keyword1', 'keyword2', 'keyword3'];
}

module.exports = exports;
