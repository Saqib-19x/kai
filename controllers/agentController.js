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
  // Add user to request body
  req.body.user = req.user.id;
  
  // Check if user is allowed to create more agents (limit to 5 for non-admin)
  if (req.user.role !== 'admin') {
    const agentsCount = await AgentConfig.countDocuments({ user: req.user.id });
    if (agentsCount >= 5) {
      return next(new ErrorResponse('You have reached the maximum number of agents (5)', 400));
    }
  }
  
  // Process knowledge sources if provided
  if (req.body.knowledgeSources && Array.isArray(req.body.knowledgeSources)) {
    // Validate document IDs if present
    const documentSources = req.body.knowledgeSources.filter(
      source => source.sourceType === 'document' && source.sourceId
    );
    
    if (documentSources.length > 0) {
      const documentIds = documentSources.map(source => source.sourceId);
      const foundDocs = await Document.countDocuments({ 
        _id: { $in: documentIds } 
      });
      
      if (foundDocs !== documentIds.length) {
        return next(new ErrorResponse('One or more document IDs are invalid', 400));
      }
    }
    
    // Validate website URLs if present
    const websiteSources = req.body.knowledgeSources.filter(
      source => source.sourceType === 'website' && source.url
    );
    
    for (const source of websiteSources) {
      if (!/^(http|https):\/\/[^ "]+$/.test(source.url)) {
        return next(new ErrorResponse(`Invalid URL: ${source.url}`, 400));
      }
    }
  }
  
  // For backward compatibility, copy allowedDocuments to knowledgeSources if knowledgeSources not provided
  if (req.body.allowedDocuments && (!req.body.knowledgeSources || req.body.knowledgeSources.length === 0)) {
    req.body.knowledgeSources = req.body.allowedDocuments.map(docId => ({
      sourceType: 'document',
      sourceId: docId
    }));
  }
  
  // Create agent
  const agent = await AgentConfig.create(req.body);
  
  res.status(201).json({
    success: true,
    data: agent
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

// @desc    Train agent with custom data
// @route   POST /api/agents/:id/train
// @access  Private
exports.trainAgent = asyncHandler(async (req, res, next) => {
  const { trainingData } = req.body;
  
  if (!trainingData) {
    return next(new ErrorResponse('Please provide training data', 400));
  }
  
  const agent = await AgentConfig.findById(req.params.id);
  
  if (!agent) {
    return next(new ErrorResponse(`Agent not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user owns the agent
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to train this agent`, 401));
  }
  
  // Process and add the training data to the agent
  agent.trainingData = trainingData;
  
  // Enhance the system prompt based on the training data
  const enhancedPrompt = await openaiService.enhanceSystemPromptWithTraining(
    agent.systemPrompt,
    trainingData
  );
  
  agent.systemPrompt = enhancedPrompt;
  await agent.save();
  
  res.status(200).json({
    success: true,
    data: agent
  });
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