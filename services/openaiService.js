const { OpenAI } = require('openai');
const Document = require('../models/Document');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate a response using OpenAI GPT model
   * @param {Array} messages Array of conversation messages
   * @param {Array} documentIds Array of document IDs to use as context
   * @returns {Promise<Object>} OpenAI response
   */
  async generateResponse(messages, documentIds = []) {
    try {
      // If documents are provided, fetch their content and add as context
      let contextText = '';
      if (documentIds && documentIds.length > 0) {
        const documents = await Document.find({
          _id: { $in: documentIds },
          processingStatus: 'completed'
        });
        
        contextText = documents
          .map(doc => `Document: ${doc.originalName}\n${doc.extractedText}`)
          .join('\n\n');
      }

      // Create a new messages array that includes the context
      let conversationMessages = [...messages];
      
      // If we have document context, add it to the system message or create one
      if (contextText) {
        const systemMessageIndex = conversationMessages.findIndex(msg => msg.role === 'system');
        
        const contextMessage = {
          role: 'system',
          content: `You are a helpful assistant that responds to user queries. Use the following extracted document content as reference when needed:\n\n${contextText}`
        };
        
        if (systemMessageIndex >= 0) {
          // Update existing system message
          conversationMessages[systemMessageIndex] = contextMessage;
        } else {
          // Add new system message at the beginning
          conversationMessages.unshift(contextMessage);
        }
      } else if (!conversationMessages.some(msg => msg.role === 'system')) {
        // Add a default system message if none exists
        conversationMessages.unshift({
          role: 'system',
          content: 'You are a helpful assistant that responds to user queries.'
        });
      }

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4', // Using GPT-4
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 1000
      });

      return response;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
}

module.exports = new OpenAIService(); 