const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const openaiService = require('../services/openaiService');
const textToSpeechService = require('../services/textToSpeechService');
const Conversation = require('../models/Conversation');
const asyncHandler = require('../middleware/async');
const openai = require('../services/openaiService');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Base URL for callbacks
const getBaseUrl = () => process.env.BASE_URL || `https://${process.env.DOMAIN || 'your-app.com'}`;

// @desc    Handle incoming voice calls
// @route   POST /api/voice/incoming
// @access  Public
exports.handleIncomingCall = asyncHandler(async (req, res, next) => {
  const twiml = new VoiceResponse();
  
  // Greet the caller
  twiml.say({
    voice: 'Polly.Joanna',
  }, 'Hello! I am your AI assistant. How can I help you today?');
  
  // Record the caller's message
  twiml.record({
    action: '/api/voice/respond',
    transcribe: true,
    transcribeCallback: '/api/voice/transcribe',
    maxLength: 30,
    timeout: 5
  });
  
  // Respond with TwiML
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// @desc    Respond to caller after recording
// @route   POST /api/voice/respond
// @access  Public
exports.respondToCall = asyncHandler(async (req, res, next) => {
  const twiml = new VoiceResponse();
  
  // Let the caller know we're processing
  twiml.say({
    voice: 'Polly.Joanna',
  }, 'Thank you for your message. Please wait while I process your request.');
  
  // Add a pause to give time for transcription and processing
  twiml.pause({ length: 5 });
  
  // Tell the caller to wait for the callback
  twiml.say({
    voice: 'Polly.Joanna',
  }, 'I am preparing your response. This might take a moment.');
  
  // Play hold music
  twiml.play({ loop: 0 }, 'https://demo.twilio.com/docs/classic.mp3');
  
  // Send TwiML response
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// @desc    Process transcription and generate AI response
// @route   POST /api/voice/transcribe
// @access  Public
exports.processTranscription = asyncHandler(async (req, res, next) => {
  try {
    const callSid = req.body.CallSid;
    const transcriptionText = req.body.TranscriptionText;
    
    if (!transcriptionText) {
      console.error('No transcription text provided');
      return res.status(400).json({ success: false, error: 'No transcription text provided' });
    }
    
    // Create or find a conversation for this call
    let conversation = await Conversation.findOne({ 'metadata.callSid': callSid });
    
    if (!conversation) {
      conversation = await Conversation.create({
        title: `Voice Call - ${new Date().toLocaleString()}`,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant handling a voice call. Keep responses conversational and concise.',
            timestamp: Date.now()
          }
        ],
        metadata: { callSid }
      });
    }
    
    // Add the transcribed message to the conversation
    conversation.messages.push({
      role: 'user',
      content: transcriptionText,
      timestamp: Date.now()
    });
    
    // Generate AI response
    const response = await openaiService.generateResponse(conversation.messages);
    const aiResponseText = response.choices[0].message.content;
    
    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponseText,
      timestamp: Date.now()
    });
    
    await conversation.save();
    
    // Convert AI response to speech
    const audioContent = await textToSpeechService.synthesizeSpeech(aiResponseText);
    
    // Get Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Call back the user with the AI response
    await client.calls(callSid)
      .update({
        twiml: new VoiceResponse()
          .say({ voice: 'Polly.Joanna' }, aiResponseText)
          .toString()
      });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing transcription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Handle initial greeting TwiML for incoming calls
 * @route   POST /api/voice/initial-greeting
 * @access  Public (Twilio webhook)
 */
exports.getInitialGreeting = (req, res) => {
  console.log('Initial greeting for call:', req.body.CallSid);
  
  const twiml = new VoiceResponse();
  
  // Add gather with enhanced settings
  const gather = twiml.gather({
    input: 'speech',
    action: '/api/voice/respond',
    method: 'POST',
    language: 'en-US',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,
    profanityFilter: false,
    timeout: 5
  });
  
  // Optimized greeting
  gather.say({
    voice: 'Polly.Joanna-Neural',
    language: 'en-US',
  }, "Hi there! How can I help you today?");
  
  // Add fallback to prevent disconnection
  twiml.redirect('/api/voice/respond');
  
  return res.type('text/xml').send(twiml.toString());
};

/**
 * Make an outbound call using Twilio
 * @route   POST /api/voice/call
 * @access  Private
 */
exports.makeCall = asyncHandler(async (req, res) => {
  const { phoneNumber, userId } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ 
      success: false, 
      error: 'Phone number is required' 
    });
  }

  try {
    const baseUrl = getBaseUrl();
    
    // Create call with optimized settings
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      url: `${baseUrl}/api/voice/initial-greeting`,
      statusCallback: `${baseUrl}/api/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: 'Enable',
      asyncAmd: true,
      amdStatusCallback: `${baseUrl}/api/voice/amd-status`,
      record: process.env.RECORD_CALLS === 'true'
    });

    // Log call in database if needed
    // await saveCallRecord(call.sid, userId, phoneNumber);

    res.status(200).json({
      success: true,
      data: {
        callSid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to
      }
    });
  } catch (error) {
    console.error('Error making Twilio call:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Handle call status updates from Twilio
 * @route   POST /api/voice/status
 * @access  Public (Twilio webhook)
 */
exports.handleCallStatus = asyncHandler(async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  
  console.log(`Call ${CallSid} status updated to ${CallStatus}`, {
    duration: CallDuration || 0,
    from: req.body.From,
    to: req.body.To
  });
  
  // Update call in database if needed
  // await updateCallStatus(CallSid, CallStatus, CallDuration);
  
  res.sendStatus(200);
});

/**
 * Handle AMD (Answering Machine Detection) status
 * @route   POST /api/voice/amd-status
 * @access  Public (Twilio webhook)
 */
exports.handleAmdStatus = asyncHandler(async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  
  console.log(`Call ${CallSid} answered by ${AnsweredBy}`);
  
  // Update call in database if needed
  // await updateCallAnsweredBy(CallSid, AnsweredBy);
  
  res.sendStatus(200);
});

module.exports = exports; 