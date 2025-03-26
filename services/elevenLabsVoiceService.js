const elevenLabs = require('./elevenLabsService');
const WebSocket = require('ws');
const cache = require('memory-cache');

class ElevenLabsVoiceService {
  constructor() {
    this.basePath = '/voices';
    this.cacheTime = 24 * 60 * 60 * 1000; // 24 hours
    this.activeStreams = new Map();
  }

  // Get all voices
  async getVoices() {
    const cacheKey = 'elevenlabs_voices';
    const cachedVoices = cache.get(cacheKey);
    
    if (cachedVoices) return cachedVoices;
    
    const voices = await elevenLabs.get(this.basePath);
    cache.put(cacheKey, voices, this.cacheTime);
    
    return voices;
  }

  // Get voice by ID
  async getVoice(voiceId) {
    const cacheKey = `elevenlabs_voice_${voiceId}`;
    const cachedVoice = cache.get(cacheKey);
    
    if (cachedVoice) return cachedVoice;
    
    const voice = await elevenLabs.get(`${this.basePath}/${voiceId}`);
    cache.put(cacheKey, voice, this.cacheTime);
    
    return voice;
  }

  // Create TTS stream connection
  createTTSStream(voiceId, options = {}) {
    const queryParams = new URLSearchParams({
      optimize_streaming_latency: options.optimizeLatency || 3,
      output_format: options.outputFormat || 'mp3_44100',
      auto_mode: options.autoMode !== undefined ? options.autoMode : true,
      sync_alignment: options.syncAlignment !== undefined ? options.syncAlignment : true,
    });

    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?${queryParams.toString()}`;
    
    const ws = new WebSocket(wsUrl, {
      headers: {
        'xi-api-key': elevenLabs.apiKey
      }
    });

    return ws;
  }

  // Manage TTS stream with voice settings
  async streamTextToSpeech(voiceId, text, callbackFn, options = {}) {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const voiceSettings = options.voiceSettings || {
      stability: 0.5,
      similarity_boost: 0.75,
      speed: 1.0
    };

    // Create WebSocket connection
    const ws = this.createTTSStream(voiceId, options);
    
    this.activeStreams.set(streamId, ws);
    
    // Set up event handlers
    ws.on('open', () => {
      console.log(`TTS stream ${streamId} opened`);
      
      // Send initial settings
      ws.send(JSON.stringify({
        text: " ",
        voice_settings: voiceSettings
      }));
      
      // Break text into natural chunks and send
      const textChunks = this.breakTextIntoChunks(text);
      
      textChunks.forEach((chunk, index) => {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              text: chunk,
              try_trigger_generation: true
            }));
            
            // If it's the last chunk, send empty text to signal end
            if (index === textChunks.length - 1) {
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ text: "" }));
                }
              }, 100);
            }
          }
        }, index * 50); // Small delay between chunks for natural flow
      });
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.audio) {
          callbackFn({
            audio: Buffer.from(response.audio, 'base64'),
            alignment: response.alignment || null,
            streamId
          });
        }
      } catch (error) {
        console.error('Error parsing TTS stream message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`TTS stream ${streamId} closed`);
      this.activeStreams.delete(streamId);
    });
    
    ws.on('error', (error) => {
      console.error('TTS stream error:', error);
      this.activeStreams.delete(streamId);
    });
    
    return streamId;
  }

  // Close a specific stream
  closeStream(streamId) {
    const ws = this.activeStreams.get(streamId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      this.activeStreams.delete(streamId);
    }
  }

  // Close all active streams
  closeAllStreams() {
    for (const [streamId, ws] of this.activeStreams.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.activeStreams.clear();
  }

  // Utility to break text into natural chunks for speech
  breakTextIntoChunks(text, maxChunkLength = 150) {
    // Split by sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        
        // If sentence is too long, split it further
        if (sentence.length > maxChunkLength) {
          // Split by commas or other pause markers
          const parts = sentence.split(/,|;|\s-\s/);
          let partChunk = '';
          
          for (const part of parts) {
            if ((partChunk + part).length <= maxChunkLength) {
              partChunk += part + (part.endsWith(',') || part.endsWith(';') ? ' ' : ', ');
            } else {
              if (partChunk) chunks.push(partChunk);
              partChunk = part + (part.endsWith(',') || part.endsWith(';') ? ' ' : ', ');
            }
          }
          
          if (partChunk) chunks.push(partChunk);
        } else {
          chunks.push(sentence);
        }
        
        currentChunk = '';
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    
    return chunks;
  }
}

module.exports = new ElevenLabsVoiceService(); 