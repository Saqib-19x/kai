const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const asyncHandler = require('../middleware/async');
const { OpenAI } = require('openai');
const cache = require('memory-cache');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds
const CONVERSATION_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CONVERSATION_LENGTH = 6; // Limit context for speed
const DEFAULT_PROMPT = `You are a helpful AI assistant for our company. Keep responses brief and conversational.
Key information to know:
- We provide AI document processing services
- Our pricing starts at $19/month
- Services include: document extraction, conversation AI, and voice interaction
- Current special offer: 30-day free trial`;

// Voice configuration
const VOICE_CONFIG = {
  voice: 'Polly.Joanna-Neural',
  language: 'en-US'
};

/**
 * Handle voice responses during a call
 * @route   POST /api/voice/respond
 * @access  Public (Twilio webhook)
 */
exports.handleVoiceResponse = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const callSid = req.body.CallSid;
  const userInput = req.body.SpeechResult || '';
  
  console.log(`Processing voice response for call ${callSid}`, {
    userInput: userInput || '[No speech detected]',
    confidence: req.body.Confidence || 'N/A'
  });

  // Create TwiML response
  const twiml = new VoiceResponse();
  
  // Handle empty user input
  if (!userInput) {
    return handleEmptyInput(twiml, res);
  }

  try {
    // Process user input
    const aiResponse = await processUserInput(callSid, userInput);
    
    // Create gather with the AI response
    const gather = twiml.gather({
      input: 'speech',
      action: '/api/voice/respond',
      method: 'POST',
      language: 'en-US',
      speechTimeout: 'auto',
      enhanced: true,
      timeout: 3
    });
    
    gather.say(VOICE_CONFIG, aiResponse);
    
    // Add a fallback redirect in case no input is received
    twiml.redirect('/api/voice/respond');
    
    // Log performance
    console.log(`Request completed in ${Date.now() - startTime}ms`);
    
    return res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in voice response:', error);
    return handleError(twiml, res);
  }
});

/**
 * Process user input and generate AI response
 * @param {string} callSid - Call SID for identifying the conversation
 * @param {string} userInput - User's speech input
 * @returns {Promise<string>} AI response
 */
async function processUserInput(callSid, userInput) {
  // Check cache first
  const cacheKey = `${callSid}:${userInput}`;
  const cachedResponse = cache.get(cacheKey);
  
  if (cachedResponse) {
    console.log('Using cached response');
    return cachedResponse;
  }
  
  // Get or initialize conversation history
  let conversation = cache.get(`conv:${callSid}`) || [];
  if (conversation.length === 0) {
    conversation = [{ role: 'system', content: DEFAULT_PROMPT }];
  }
  
  // Add user input to conversation
  conversation.push({ role: 'user', content: userInput });
  
  // Trim conversation if it's too long (for speed)
  if (conversation.length > MAX_CONVERSATION_LENGTH) {
    // Keep system prompt and most recent exchanges
    conversation = [
      conversation[0],
      ...conversation.slice(conversation.length - MAX_CONVERSATION_LENGTH + 1)
    ];
  }
  
  // Generate AI response
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // Using 3.5 for speed, use gpt-4 if quality is more important
    messages: conversation,
    temperature: 0.7,
    max_tokens: 100, // Keep responses short for better voice experience
    top_p: 1
  });
  
  const aiResponse = completion.choices[0].message.content.trim();
  
  // Update conversation with AI response
  conversation.push({ role: 'assistant', content: aiResponse });
  
  // Cache the results
  cache.put(cacheKey, aiResponse, CACHE_TTL);
  cache.put(`conv:${callSid}`, conversation, CONVERSATION_TTL);
  
  return aiResponse;
}

/**
 * Handle empty user input
 * @param {VoiceResponse} twiml - Twilio Voice Response object
 * @param {Object} res - Express response object
 */
function handleEmptyInput(twiml, res) {
  const gather = twiml.gather({
    input: 'speech',
    action: '/api/voice/respond',
    method: 'POST',
    language: 'en-US',
    speechTimeout: 'auto',
    enhanced: true,
    timeout: 5
  });
  
  gather.say(VOICE_CONFIG, "I'm here to help. What would you like to know?");
  
  // Add fallback redirect
  twiml.redirect('/api/voice/respond');
  
  return res.type('text/xml').send(twiml.toString());
}

/**
 * Handle errors during voice response processing
 * @param {VoiceResponse} twiml - Twilio Voice Response object
 * @param {Object} res - Express response object
 */
function handleError(twiml, res) {
  const gather = twiml.gather({
    input: 'speech',
    action: '/api/voice/respond',
    method: 'POST',
    language: 'en-US',
    speechTimeout: 'auto',
    enhanced: true,
    timeout: 5
  });
  
  gather.say(VOICE_CONFIG, "I'm sorry, I encountered an issue. Could you please repeat that?");
  
  // Add fallback redirect
  twiml.redirect('/api/voice/respond');
  
  return res.type('text/xml').send(twiml.toString());
}

module.exports = exports; 