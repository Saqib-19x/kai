const Conversation = require('../models/Conversation');
const Document = require('../models/Document');
const openaiService = require('../services/openaiService');
const asyncHandler = require('../middleware/async');

// @desc    Start a new conversation
// @route   POST /api/conversations
// @access  Public
exports.createConversation = asyncHandler(async (req, res, next) => {
  const { title, documentIds = [] } = req.body;

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
    messages: []
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
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Message content is required'
    });
  }

  // Find conversation by ID
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: 'Conversation not found'
    });
  }

  // Add user message to conversation
  const userMessage = {
    role: 'user',
    content,
    timestamp: Date.now()
  };

  conversation.messages.push(userMessage);

  // Generate AI response using OpenAI
  const response = await openaiService.generateResponse(
    conversation.messages,
    conversation.documentIds
  );

  // Add AI response to conversation
  const assistantMessage = {
    role: 'assistant',
    content: response.choices[0].message.content,
    timestamp: Date.now()
  };

  conversation.messages.push(assistantMessage);

  // Save updated conversation
  await conversation.save();

  res.status(200).json({
    success: true,
    data: {
      conversation,
      assistantResponse: assistantMessage
    }
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

  await conversation.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
}); 