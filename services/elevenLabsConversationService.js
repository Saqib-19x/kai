const elevenLabs = require('./elevenLabsService');

class ElevenLabsConversationService {
  constructor() {
    this.basePath = '/conversations';
  }

  // Create a new conversation
  async createConversation(agentId, initialMessage = null) {
    return await elevenLabs.post(this.basePath, {
      agent_id: agentId,
      initial_message: initialMessage
    });
  }

  // Get all conversations
  async getConversations(page = 1, pageSize = 10) {
    return await elevenLabs.get(this.basePath, {
      page,
      page_size: pageSize
    });
  }

  // Get conversation by ID
  async getConversation(conversationId) {
    return await elevenLabs.get(`${this.basePath}/${conversationId}`);
  }

  // Get conversation history
  async getConversationHistory(conversationId) {
    return await elevenLabs.get(`${this.basePath}/${conversationId}/history`);
  }

  // Send message to conversation
  async sendMessage(conversationId, message) {
    return await elevenLabs.post(`${this.basePath}/${conversationId}/messages`, {
      message
    });
  }

  // Get the last message from a conversation
  async getLastMessage(conversationId) {
    const history = await this.getConversationHistory(conversationId);
    return history.history[history.history.length - 1];
  }
}

module.exports = new ElevenLabsConversationService(); 