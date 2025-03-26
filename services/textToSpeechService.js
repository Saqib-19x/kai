const textToSpeech = require('@google-cloud/text-to-speech');

class TextToSpeechService {
  constructor() {
    this.client = new textToSpeech.TextToSpeechClient();
  }

  /**
   * Convert text to speech audio
   * @param {string} text The text to convert to speech
   * @returns {Promise<Buffer>} Audio content as a buffer
   */
  async synthesizeSpeech(text) {
    try {
      // Construct the request
      const request = {
        input: { text },
        // Select the language and SSML voice gender
        voice: {
          languageCode: 'en-US',
          ssmlGender: 'NEUTRAL',
          name: 'en-US-Neural2-F' // Using a high-quality neural voice
        },
        // Select the type of audio encoding
        audioConfig: { audioEncoding: 'MP3' },
      };

      // Perform the text-to-speech request
      const [response] = await this.client.synthesizeSpeech(request);
      
      return response.audioContent;
    } catch (error) {
      console.error('Text-to-Speech API Error:', error);
      throw new Error(`Failed to convert text to speech: ${error.message}`);
    }
  }

  async generateSpeech(text, voiceProfile, callSid) {
    // Select provider based on quality/latency needs
    switch(voiceProfile.provider) {
      case 'elevenlabs': // Most natural, higher latency
        return await this.generateElevenLabsSpeech(text, voiceProfile, callSid);
        
      case 'playht': // Good balance of quality/speed
        return await this.generatePlayHTSpeech(text, voiceProfile, callSid);
        
      case 'azure': // Very low latency, good quality
        return await this.generateAzureSpeech(text, voiceProfile, callSid);
        
      default:
        return await this.generateAWSSpeech(text, voiceProfile, callSid);
    }
  }

  // Stream TTS output directly to call
  async streamSpeechToCall(callSid, textChunks, voiceProfile) {
    // Use techniques like sentence-based streaming
    // Generate TTS for each chunk while previous chunk is being played
    
    for (const chunk of textChunks) {
      const audioStream = await this.generateSpeech(chunk, voiceProfile);
      await this.streamAudioToCall(callSid, audioStream);
    }
  }
}

module.exports = new TextToSpeechService(); 