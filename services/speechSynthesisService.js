const elevenLabsVoiceService = require('./elevenLabsVoiceService');

class SpeechSynthesisService {
  constructor() {
    this.activeStreams = new Map();
  }

  /**
   * Synthesize speech using ElevenLabs streaming API
   * @param {string} text - Text to convert to speech
   * @param {string} voiceId - ElevenLabs voice ID
   * @param {Function} onAudioChunk - Callback for each audio chunk
   * @param {Object} options - Voice settings and options
   */
  async synthesizeSpeech(text, voiceId, onAudioChunk, options = {}) {
    const streamId = await elevenLabsVoiceService.streamTextToSpeech(
      voiceId,
      text,
      onAudioChunk,
      options
    );

    this.activeStreams.set(streamId, {
      text,
      voiceId,
      startTime: Date.now()
    });

    return streamId;
  }

  /**
   * Stop speech synthesis
   * @param {string} streamId - ID of stream to stop
   */
  stopSpeechSynthesis(streamId) {
    if (this.activeStreams.has(streamId)) {
      elevenLabsVoiceService.closeStream(streamId);
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  /**
   * Get all active speech synthesis streams
   */
  getActiveStreams() {
    return Array.from(this.activeStreams.entries()).map(([id, data]) => ({
      streamId: id,
      text: data.text,
      voiceId: data.voiceId,
      duration: Date.now() - data.startTime
    }));
  }
}

module.exports = new SpeechSynthesisService(); 