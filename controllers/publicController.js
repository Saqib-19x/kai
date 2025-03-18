const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const AgentConfig = require('../models/AgentConfig');
const Conversation = require('../models/Conversation');
const openaiService = require('../services/openaiService');

// @desc    Create a public conversation with an agent
// @route   POST /api/public/conversations
// @access  Public
exports.createPublicConversation = asyncHandler(async (req, res, next) => {
  const { agentId } = req.body;
  
  if (!agentId) {
    return next(new ErrorResponse('Please provide an agent ID', 400));
  }
  
  // Find the agent
  const agent = await AgentConfig.findById(agentId);
  
  if (!agent) {
    return next(new ErrorResponse('Agent not found', 404));
  }
  
  // Create a conversation
  const conversation = await Conversation.create({
    title: 'Website Chat',
    agentConfig: agentId,
    messages: [
      {
        role: 'system',
        content: agent.systemPrompt,
        timestamp: Date.now()
      }
    ]
  });
  
  res.status(201).json({
    success: true,
    data: conversation
  });
});

// @desc    Send message to agent in public conversation
// @route   POST /api/public/conversations/:id/messages
// @access  Public
exports.sendPublicMessage = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  
  if (!content) {
    return next(new ErrorResponse('Please provide a message', 400));
  }
  
  // Find conversation
  const conversation = await Conversation.findById(req.params.id);
  
  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
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
  
  // Generate AI response using the agent configuration
  const response = await openaiService.generateAgentResponse({
    agentConfig,
    messages: recentMessages
  });
  
  // Add AI response to conversation
  const assistantMessage = {
    role: 'assistant',
    content: response.choices[0].message.content,
    timestamp: Date.now()
  };
  
  conversation.messages.push(assistantMessage);
  
  // Save updated conversation
  await conversation.save();
  
  // Return response with the AI message
  return res.status(200).json({
    success: true,
    data: assistantMessage
  });
}); 