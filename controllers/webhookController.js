const asyncHandler = require('../middleware/async');
const VoiceAgent = require('../models/VoiceAgent');
const CallSession = require('../models/CallSession');

/**
 * @desc    Handle ElevenLabs call status webhook
 * @route   POST /api/webhooks/elevenlabs/call-status
 * @access  Public (secured by webhook secret)
 */
exports.handleCallStatus = asyncHandler(async (req, res) => {
  const { 
    call_id, 
    status, 
    duration,
    agent_id,
    phone_number,
    recording_url,
    conversation 
  } = req.body;
  
  console.log(`ElevenLabs call status webhook: ${call_id} - ${status}`);
  
  // Validate webhook signature (implement your validation logic here)
  // verifyElevenLabsWebhook(req);
  
  // Find call session by ElevenLabs call ID
  let callSession = await CallSession.findOne({ elevenlabsCallId: call_id });
  
  if (!callSession) {
    // If not found, try to find the agent by ElevenLabs agent ID
    const voiceAgent = await VoiceAgent.findOne({ elevenLabsAgentId: agent_id });
    
    if (voiceAgent) {
      // Create a new call session if we can link it to our agent
      callSession = await CallSession.create({
        agentId: voiceAgent._id,
        phoneNumber: phone_number || "Unknown",
        elevenlabsCallId: call_id,
        status: mapElevenLabsStatus(status),
        recordingUrl: recording_url
      });
    } else {
      // We can't link this call to our system
      return res.status(200).json({ received: true });
    }
  } else {
    // Update existing call session
    callSession.status = mapElevenLabsStatus(status);
    
    if (duration) {
      callSession.duration = duration;
    }
    
    if (recording_url) {
      callSession.recordingUrl = recording_url;
    }
    
    // Update call messages if conversation data is provided
    if (conversation && Array.isArray(conversation.history)) {
      const formattedMessages = conversation.history.map(msg => ({
        role: msg.from === 'agent' ? 'assistant' : 'user',
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime()
      }));
      
      callSession.messages = formattedMessages;
    }
    
    await callSession.save();
    
    // If call is completed, update agent stats
    if (status === 'completed' && callSession.agentId) {
      const agent = await VoiceAgent.findById(callSession.agentId);
      if (agent) {
        await agent.incrementCallStats(
          callSession.duration, 
          callSession.metrics.successfulOutcome
        );
      }
    }
  }
  
  res.status(200).json({ received: true });
});

/**
 * Map ElevenLabs call status to our status format
 */
function mapElevenLabsStatus(elevenLabsStatus) {
  const statusMap = {
    'initiated': 'initiated',
    'ringing': 'initiated',
    'in-progress': 'in-progress',
    'completed': 'completed',
    'failed': 'failed',
    'no-answer': 'failed',
    'busy': 'failed'
  };
  
  return statusMap[elevenLabsStatus] || 'initiating';
}

/**
 * @desc    Handle ElevenLabs conversation update webhook
 * @route   POST /api/webhooks/elevenlabs/conversation
 * @access  Public (secured by webhook secret)
 */
exports.handleConversationUpdate = asyncHandler(async (req, res) => {
  const { 
    conversation_id, 
    agent_id,
    call_id,
    message
  } = req.body;
  
  // Find call session
  if (call_id) {
    const callSession = await CallSession.findOne({ elevenlabsCallId: call_id });
    
    if (callSession) {
      // Add new message if provided
      if (message) {
        callSession.messages.push({
          role: message.from === 'agent' ? 'assistant' : 'user',
          content: message.content,
          timestamp: new Date(message.timestamp).getTime()
        });
        
        await callSession.save();
      }
    }
  }
  
  res.status(200).json({ received: true });
});

module.exports = exports; 