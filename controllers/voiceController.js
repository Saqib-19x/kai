const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const openaiService = require('../services/openaiService');
const textToSpeechService = require('../services/textToSpeechService');
const Conversation = require('../models/Conversation');
const asyncHandler = require('../middleware/async');

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