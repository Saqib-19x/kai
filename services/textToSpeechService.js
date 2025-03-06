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
}

module.exports = new TextToSpeechService(); 