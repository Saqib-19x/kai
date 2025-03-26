const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const VoiceAgent = require('../models/VoiceAgent');
const CallSession = require('../models/CallSession');
const speechToTextService = require('../services/speechToTextService');
const llmService = require('../services/llmService');
const textToSpeechService = require('../services/textToSpeechService');
const asyncHandler = require('../middleware/async');
const elevenLabsAgentService = require('../services/elevenLabsAgentService');
const elevenLabsKnowledgeBaseService = require('../services/elevenLabsKnowledgeBaseService');
const elevenLabsConversationService = require('../services/elevenLabsConversationService');
const elevenLabsPhoneService = require('../services/elevenLabsPhoneService');
const elevenLabsVoiceService = require('../services/elevenLabsVoiceService');
const FormData = require('form-data');
const fs = require('fs');

// Create Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * @desc    Create a new voice agent
 * @route   POST /api/voice-agents
 * @access  Private
 */
exports.createVoiceAgent = asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    systemPrompt, 
    voiceId, 
    knowledgeBaseIds,
    llmModel
  } = req.body;

  // Validate required fields
  if (!name || !voiceId) {
    return res.status(400).json({
      success: false,
      error: 'Please provide name and voice ID'
    });
  }

  try {
    // Create agent in ElevenLabs
    const agentData = {
      name,
      description: description || '',
      initial_message: "Hello, how can I help you today?",
      llm_configuration: {
        model: llmModel || "gpt-4o",
        temperature: 0.7,
        max_tokens: 150
      },
      voice_id: voiceId,
      knowledge_base_ids: knowledgeBaseIds || []
    };

    // Create agent in ElevenLabs
    const elevenLabsAgent = await elevenLabsAgentService.createAgent(agentData);

    // Store agent in our database with reference to ElevenLabs ID
    const voiceAgent = await VoiceAgent.create({
      userId: req.user.id,
      name,
      description: description || '',
      systemPrompt: systemPrompt || "You are a helpful AI assistant on a phone call. Keep responses conversational and concise.",
      elevenLabsAgentId: elevenLabsAgent.agent_id,
      voiceProfile: {
        provider: 'elevenlabs',
        voiceId: voiceId
      },
      knowledgeBaseIds: knowledgeBaseIds || [],
      llmConfig: {
        model: llmModel || "gpt-4o",
        temperature: 0.7,
        maxTokens: 150
      }
    });

    res.status(201).json({
      success: true,
      data: voiceAgent
    });
  } catch (error) {
    console.error('Error creating voice agent:', error);
    res.status(500).json({
      success: false,
      error: `Failed to create voice agent: ${error.message}`
    });
  }
});

/**
 * @desc    Get all voice agents for user
 * @route   GET /api/voice-agents
 * @access  Private
 */
exports.getVoiceAgents = asyncHandler(async (req, res) => {
  const voiceAgents = await VoiceAgent.find({ userId: req.user.id });

  res.status(200).json({
    success: true,
    count: voiceAgents.length,
    data: voiceAgents
  });
});

/**
 * @desc    Get voice agent by ID
 * @route   GET /api/voice-agents/:id
 * @access  Private
 */
exports.getVoiceAgent = asyncHandler(async (req, res) => {
  const voiceAgent = await VoiceAgent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!voiceAgent) {
    return res.status(404).json({
      success: false,
      error: 'Voice agent not found'
    });
  }

  res.status(200).json({
    success: true,
    data: voiceAgent
  });
});

/**
 * @desc    Update voice agent
 * @route   PUT /api/voice-agents/:id
 * @access  Private
 */
exports.updateVoiceAgent = asyncHandler(async (req, res) => {
  let voiceAgent = await VoiceAgent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!voiceAgent) {
    return res.status(404).json({
      success: false,
      error: 'Voice agent not found'
    });
  }

  // Update in ElevenLabs if agent ID exists
  if (voiceAgent.elevenLabsAgentId) {
    try {
      const updateData = {
        name: req.body.name || voiceAgent.name,
        description: req.body.description || voiceAgent.description,
        llm_configuration: {
          model: req.body.llmConfig?.model || voiceAgent.llmConfig.model,
          temperature: req.body.llmConfig?.temperature || voiceAgent.llmConfig.temperature,
          max_tokens: req.body.llmConfig?.maxTokens || voiceAgent.llmConfig.maxTokens
        }
      };

      if (req.body.voiceProfile?.voiceId) {
        updateData.voice_id = req.body.voiceProfile.voiceId;
      }

      if (req.body.knowledgeBaseIds) {
        updateData.knowledge_base_ids = req.body.knowledgeBaseIds;
      }

      await elevenLabsAgentService.updateAgent(voiceAgent.elevenLabsAgentId, updateData);
    } catch (error) {
      console.error('Error updating ElevenLabs agent:', error);
      // Continue with local update even if ElevenLabs update fails
    }
  }

  // Update in our database
  voiceAgent = await VoiceAgent.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: voiceAgent
  });
});

/**
 * @desc    Delete voice agent
 * @route   DELETE /api/voice-agents/:id
 * @access  Private
 */
exports.deleteVoiceAgent = asyncHandler(async (req, res) => {
  const voiceAgent = await VoiceAgent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!voiceAgent) {
    return res.status(404).json({
      success: false,
      error: 'Voice agent not found'
    });
  }

  // Delete from ElevenLabs if agent ID exists
  if (voiceAgent.elevenLabsAgentId) {
    try {
      await elevenLabsAgentService.deleteAgent(voiceAgent.elevenLabsAgentId);
    } catch (error) {
      console.error('Error deleting ElevenLabs agent:', error);
      // Continue with local deletion even if ElevenLabs deletion fails
    }
  }

  await voiceAgent.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Initiate a call with a voice agent
 * @route   POST /api/voice-agents/:id/call
 * @access  Private
 */
exports.initiateAgentCall = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }
  
  const voiceAgent = await VoiceAgent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!voiceAgent) {
    return res.status(404).json({
      success: false,
      error: 'Voice agent not found'
    });
  }
  
  if (!voiceAgent.elevenLabsAgentId) {
    return res.status(400).json({
      success: false,
      error: 'Voice agent not configured with ElevenLabs'
    });
  }
  
  try {
    // Get available phone numbers from account
    const phoneNumbers = await elevenLabsPhoneService.getPhoneNumbers();
    
    if (!phoneNumbers.phone_numbers || phoneNumbers.phone_numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No phone numbers available in ElevenLabs account'
      });
    }
    
    // Use the first available phone number
    const sourcePhoneNumber = phoneNumbers.phone_numbers[0];
    
    // Initiate call
    const call = await elevenLabsPhoneService.initiateCall(
      sourcePhoneNumber.id,
      phoneNumber,
      voiceAgent.elevenLabsAgentId
    );
    
    // Create call session record
    const callSession = await CallSession.create({
      agentId: voiceAgent._id,
      phoneNumber,
      status: 'initiated',
      elevenlabsCallId: call.call_id,
      messages: []
    });
    
    res.status(200).json({
      success: true,
      data: {
        sessionId: callSession._id,
        callId: call.call_id,
        status: call.status
      }
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({
      success: false,
      error: `Failed to initiate call: ${error.message}`
    });
  }
});

/**
 * @desc    Upload files to knowledge base
 * @route   POST /api/voice-agents/knowledge-base/:knowledgeBaseId/upload
 * @access  Private
 */
exports.uploadKnowledgeBase = asyncHandler(async (req, res) => {
  const { knowledgeBaseId } = req.params;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Please upload at least one file'
    });
  }
  
  try {
    // Upload files to ElevenLabs knowledge base
    const result = await elevenLabsKnowledgeBaseService.uploadFiles(
      knowledgeBaseId,
      req.files
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error uploading knowledge base files:', error);
    res.status(500).json({
      success: false,
      error: `Failed to upload files: ${error.message}`
    });
  }
});

/**
 * @desc    Create a new knowledge base
 * @route   POST /api/voice-agents/knowledge-base
 * @access  Private
 */
exports.createKnowledgeBase = asyncHandler(async (req, res) => {
  const { name, url } = req.body;
  const file = req.file;

  console.log('Received request:', {
    name: name || 'not provided',
    url: url || 'not provided',
    file: file ? `${file.originalname} (${file.mimetype})` : 'not provided'
  });

  try {
    const formData = new FormData();
    
    // Add name if provided
    if (name) {
      formData.append('name', name);
      console.log('Added name to form data');
    }

    // Only add URL if no file is provided
    if (url && !file) {
      formData.append('url', url);
      console.log('Added url to form data');
    }
    
    // Only add file if no URL is provided
    if (file && !url) {
      // Create a readable stream from the buffer
      const stream = require('stream');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(file.buffer);

      formData.append('file', bufferStream, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.buffer.length
      });
      console.log('Added file to form data:', file.originalname);
    }

    // Validate that we're sending either url OR file, not both
    if (!url && !file) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a URL or a file to upload'
      });
    }

    const knowledgeBase = await elevenLabsKnowledgeBaseService.createKnowledgeBase(
      formData
    );
    
    res.status(201).json({
      success: true,
      data: knowledgeBase
    });
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: `Failed to create knowledge base: ${error.message}`
    });
  }
});

/**
 * @desc    Get all available voices
 * @route   GET /api/voice-agents/voices
 * @access  Private
 */
exports.getVoices = asyncHandler(async (req, res) => {
  try {
    const voices = await elevenLabsVoiceService.getVoices();
    
    res.status(200).json({
      success: true,
      data: voices
    });
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch voices: ${error.message}`
    });
  }
});

/**
 * @desc    Get all knowledge bases
 * @route   GET /api/voice-agents/knowledge-base
 * @access  Private
 */
exports.getKnowledgeBases = asyncHandler(async (req, res) => {
  try {
    const knowledgeBases = await elevenLabsKnowledgeBaseService.getKnowledgeBases();
    
    res.status(200).json({
      success: true,
      data: knowledgeBases
    });
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch knowledge bases: ${error.message}`
    });
  }
});

/**
 * @desc    Get call history for a voice agent
 * @route   GET /api/voice-agents/:id/calls
 * @access  Private
 */
exports.getAgentCallHistory = asyncHandler(async (req, res) => {
  const voiceAgent = await VoiceAgent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!voiceAgent) {
    return res.status(404).json({
      success: false,
      error: 'Voice agent not found'
    });
  }
  
  // Get call sessions from our database
  const callSessions = await CallSession.find({
    agentId: voiceAgent._id
  }).sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: callSessions.length,
    data: callSessions
  });
});

// Add a new method to upload files to existing knowledge base
exports.uploadToKnowledgeBase = asyncHandler(async (req, res) => {
  const { knowledgeBaseId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a file to upload'
    });
  }

  try {
    const result = await elevenLabsKnowledgeBaseService.uploadFiles(knowledgeBaseId, file);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error uploading to knowledge base:', error);
    res.status(500).json({
      success: false,
      error: `Failed to upload file: ${error.message}`
    });
  }
});

// Add method to create an agent with knowledge base
exports.createAgentWithKnowledgeBase = asyncHandler(async (req, res) => {
  const { 
    name, 
    description,
    knowledgeBaseId,
    voiceId 
  } = req.body;

  if (!name || !knowledgeBaseId || !voiceId) {
    return res.status(400).json({
      success: false,
      error: 'Please provide name, knowledge base ID, and voice ID'
    });
  }

  try {
    const agent = await elevenLabsAgentService.createAgent({
      name,
      description,
      knowledge_base_ids: [knowledgeBaseId],
      voice_id: voiceId
    });

    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({
      success: false,
      error: `Failed to create agent: ${error.message}`
    });
  }
});

module.exports = exports; 