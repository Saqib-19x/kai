const { OpenAI } = require('openai');
const Document = require('../models/Document');
const NodeCache = require('node-cache');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Better caching with longer TTL and larger size
    this.cache = new NodeCache({ 
      stdTTL: 60 * 60, // 1 hour
      checkperiod: 120,
      maxKeys: 1000
    });
    
    // Pre-built prompt templates for faster response
    this.promptTemplates = {
      default: "You are a helpful assistant. Provide concise, helpful responses.",
      technical: "You are a technical expert. Provide precise, technically accurate responses.",
      friendly: "You are a friendly assistant. Be conversational and approachable in your responses.",
      professional: "You are a professional assistant. Maintain formal tone and provide detailed information."
    };
    
    // Language detection cache
    this.languageCache = new Set();
    
    // Tone detection cache
    this.tonePatterns = {
      formal: [/professional/i, /formal/i, /business/i, /official/i],
      informal: [/casual/i, /informal/i, /friendly/i, /relaxed/i],
      technical: [/technical/i, /detailed/i, /explain/i, /how to/i],
      enthusiastic: [/amazing/i, /exciting/i, /love/i, /great/i]
    };
  }

  /**
   * Ultra-fast context retrieval using keyword matching
   * @param {string} query - The user query to find relevant content for
   * @param {Array|string} documents - Document IDs or document objects to search in
   * @returns {string} Relevant context extracted from documents
   */
  async ultraFastContextRetrieval(query, documents) {
    if (!query || !documents || (Array.isArray(documents) && documents.length === 0)) {
      return '';
    }
    
    console.log('Document input received:', documents);
    
    // Handle both array of objects and array of IDs
    let docIds = [];
    if (Array.isArray(documents)) {
      docIds = documents.map(doc => typeof doc === 'object' ? doc._id || doc.id : doc);
    } else {
      docIds = [documents]; // Handle single document case
    }
    
    console.log('Processed document IDs:', docIds);
    
    // Try to get from cache first
    const cacheKey = `docs_${docIds.sort().join('_')}`;
    const cachedContext = this.cache.get(cacheKey);
    
    if (cachedContext) {
      return cachedContext;
    }
    
    // Extract keywords from the query
    const keywords = this.extractKeywordsFromQuery(query);
    
    // Add some common question words to improve matching
    const commonQuestions = ['how', 'what', 'when', 'where', 'why', 'who'];
    keywords.push(...commonQuestions.filter(q => query.toLowerCase().includes(q)));
    
    console.log('Search keywords:', keywords);
    
    if (keywords.length === 0) {
      // Fall back to getting first paragraph if no keywords
      try {
        const firstDoc = await Document.findOne({ _id: { $in: docIds } }).select('extractedText');
        if (firstDoc && firstDoc.extractedText) {
          const firstParagraph = firstDoc.extractedText.split('\n\n')[0] || '';
          return firstParagraph.substring(0, 500);
        }
      } catch (error) {
        console.error('Error getting fallback paragraph:', error);
      }
      return '';
    }
    
    try {
      // Get documents with projection for efficiency
      const docs = await Document.find({
        _id: { $in: docIds }
      }).select('extractedText originalName');
      
      console.log(`Found ${docs.length} documents`);
      
      if (!docs || docs.length === 0) return '';
      
      // Score each document section by keyword matches
      let relevantSections = [];
      
      for (const doc of docs) {
        if (!doc.extractedText) {
          console.log(`Document ${doc._id} has no extracted text`);
          continue;
        }
        
        console.log(`Processing document: ${doc.originalName || doc._id}`);
        
        // Break text into sections (paragraphs)
        const sections = doc.extractedText.split(/\n\n|\.\s/).filter(section => section.length > 20);
        console.log(`Document has ${sections.length} sections`);
        
        for (const section of sections) {
          // Score by keyword matches
          let score = 0;
          const sectionLower = section.toLowerCase();
          
          for (const keyword of keywords) {
            const regex = new RegExp(keyword, 'gi');
            const matches = (sectionLower.match(regex) || []).length;
            score += matches;
          }
          
          if (score > 0) {
            relevantSections.push({
              text: section,
              score,
              docName: doc.originalName || 'Document'
            });
          }
        }
      }
      
      // Sort by relevance and take top sections
      relevantSections.sort((a, b) => b.score - a.score);
      const topSections = relevantSections.slice(0, 5).map(s => 
        `From "${s.docName}": ${s.text}`
      );
      
      console.log(`Found ${topSections.length} relevant sections`);
      
      if (topSections.length === 0) {
        return 'No specific information found in the documents for this query.';
      }
      
      const resultContext = topSections.join('\n\n');
      
      // Cache the result
      this.cache.set(cacheKey, resultContext);
      
      return resultContext;
    } catch (error) {
      console.error('Error in ultraFastContextRetrieval:', error);
      return 'Error retrieving document content.';
    }
  }

  /**
   * Generate a response using OpenAI GPT model with extreme optimizations
   */
  async generateResponse(options) {
    try {
      console.time('openai_response');
      // Handle both old and new parameter formats
      let messages, contextualInfo, language, userPreferences;
      
      if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
        ({ messages, contextualInfo, language, userPreferences } = options);
      } else {
        messages = options;
        const documentIds = arguments[1] || [];
        
        // Fast context retrieval with early return if no documents
        if (documentIds && documentIds.length > 0) {
          contextualInfo = await this.ultraFastContextRetrieval(
            messages[messages.length - 1]?.content, 
            documentIds
          );
          console.log('Context retrieved from documents:', contextualInfo?.substring(0, 100) + '...');
        }
      }

      // OPTIMIZATION: Minimal message history - only last 3-4 messages
      const recentMessages = Array.isArray(messages) ? 
        messages.slice(-4) : 
        [];
      
      // Don't use cache for document-based queries (to ensure relevant answers)
      const lastUserMessage = recentMessages.findLast(m => m.role === 'user')?.content;
      
      // Build strong system prompt that forces using document information
      let systemPrompt = "You are a knowledge base assistant that ONLY provides information from the documents provided. ";
      
      // Add language instruction only if non-English
      if (language && language !== 'en') {
        systemPrompt += `Respond in ${language} language. `;
      }
      
      // Force document-based responses
      if (contextualInfo) {
        systemPrompt += "CRITICAL INSTRUCTION: You MUST ONLY answer based on the information in the documents below. If the documents don't contain the answer, say 'I don't have information about that in my knowledge base.' DO NOT make up information or use your general knowledge.";
        
        // Add document information
        systemPrompt += `\n\nDOCUMENT KNOWLEDGE:\n${contextualInfo}`;
      } else {
        // No documents available
        systemPrompt += "You only have access to information from uploaded documents. If no document information is provided, inform the user that you don't have relevant information in your knowledge base.";
      }
      
      // Create messages array with strong emphasis on document context
      let conversationMessages = [
        { role: "system", content: systemPrompt }
      ];
      
      // Add conversation history
      conversationMessages = [...conversationMessages, ...recentMessages];
      
      // Always use GPT-3.5-Turbo for speed unless explicitly requested
      const model = (userPreferences?.model === 'gpt-4') ? 'gpt-4' : 'gpt-3.5-turbo';
      
      console.log(`Using model: ${model}, with context? ${!!contextualInfo}`);

      // Call OpenAI API with modified parameters to ensure document usage
      const response = await this.openai.chat.completions.create({
        model: model,
        messages: conversationMessages,
        temperature: 0.2, // Lower temperature for more factual responses
        max_tokens: 500
      });
      
      console.timeEnd('openai_response');
      return response;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return {
        choices: [{
          message: {
            content: "I couldn't access my knowledge base. Please try again with your question."
          }
        }],
        model: "fallback",
        error: error.message
      };
    }
  }

  // Generate a fallback response when API fails
  getFallbackResponse(error) {
    console.log('Using fallback response due to API error');
    
    return {
      choices: [{
        message: {
          content: "I understand your question. Let me get back to you with a more detailed response shortly."
        }
      }],
      model: "fallback",
      error: error.message
    };
  }
  
  // Get appropriate prompt template based on tone
  getToneTemplate(tone) {
    const normalizedTone = tone.toLowerCase();
    
    if (normalizedTone.includes('formal') || normalizedTone.includes('professional')) {
      return this.promptTemplates.professional;
    }
    
    if (normalizedTone.includes('technical') || normalizedTone.includes('detailed')) {
      return this.promptTemplates.technical;
    }
    
    if (normalizedTone.includes('friendly') || normalizedTone.includes('casual')) {
      return this.promptTemplates.friendly;
    }
    
    return this.promptTemplates.default;
  }

  // Fast keyword extraction without API calls
  extractKeywordsFromQuery(query) {
    if (!query) return [];
    
    // Common stop words to filter out
    const stopWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 
      'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'in', 'into', 'of', 'with', 'about',
      'this', 'that', 'these', 'those', 'it', 'its', 'have', 'has', 'had', 'do', 'does', 'did']);
    
    // Extract words and filter non-words and stop words
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Count frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // Get top keywords by frequency
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }

  // Quick language detection without API calls
  async detectLanguage(text) {
    // First check cache for exact text
    const cachedLanguage = this.cache.get(`lang_${text.substring(0, 50)}`);
    if (cachedLanguage) {
      return cachedLanguage;
    }
    
    // Use our quick detection first
    const quickDetected = this.quickLanguageDetection(text);
    if (quickDetected) {
      this.cache.set(`lang_${text.substring(0, 50)}`, quickDetected);
      return quickDetected;
    }
    
    // Fall back to OpenAI only if necessary
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Faster model
        messages: [
          {
            role: "system", 
            content: "You are a language detection tool. Respond only with the ISO 639-1 language code."
          },
          {
            role: "user", 
            content: `Detect language: "${text.substring(0, 100)}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      });
      
      const language = response.choices[0].message.content.trim().toLowerCase();
      
      // Cache the result
      this.cache.set(`lang_${text.substring(0, 50)}`, language);
      
      return language;
    } catch (error) {
      console.error('Error detecting language:', error);
      return 'en'; // Default to English on error
    }
  }

  // Fast tone detection without API calls
  async analyzeTone(text) {
    // Check cache first
    const cachedTone = this.cache.get(`tone_${text.substring(0, 30)}`);
    if (cachedTone) {
      return cachedTone;
    }
    
    // Fast pattern matching
    for (const [tone, patterns] of Object.entries(this.tonePatterns)) {
      if (patterns.some(pattern => pattern.test(text))) {
        this.cache.set(`tone_${text.substring(0, 30)}`, tone);
        return tone;
      }
    }
    
    // Simplified default tone based on text length and punctuation
    if (text.length < 50) return 'casual';
    if (text.includes('?')) return 'curious';
    if (text.includes('!')) return 'enthusiastic';
    if (/\b(help|please|need|assist)\b/i.test(text)) return 'concerned';
    
    // Default value without API call
    const defaultTone = 'conversational';
    this.cache.set(`tone_${text.substring(0, 30)}`, defaultTone);
    return defaultTone;
  }

  async retrieveRelevantContexts(query, documents, conversationHistory) {
    // Directly use the ultra-fast method
    return this.ultraFastContextRetrieval(query, documents);
  }

  // Extremely simple summarization to avoid API calls when possible
  async summarizeConversation(messages) {
    // Only make API call every few times, use cached or simplified summary other times
    const shouldUseFastSummary = Math.random() < 0.7; // 70% chance to use fast summary
    
    if (shouldUseFastSummary) {
      // Extract topics from recent user messages
      const userMessages = messages
        .filter(msg => msg.role === 'user')
        .slice(-3)
        .map(msg => msg.content);
      
      if (userMessages.length === 0) return '';
      
      // Create simple summary from user messages
      const combinedText = userMessages.join(' ');
      const words = combinedText.split(/\s+/).filter(w => w.length > 3);
      const topWords = [...new Set(words)].slice(0, 5);
      
      return `Conversation about ${topWords.join(', ')}.`;
    }
    
    // Fall back to API for more accurate summary occasionally
    try {
      // Limit to last 5 messages to reduce tokens
      const recentMessages = messages.slice(-5);
      
      const conversationText = recentMessages.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}`
      ).join('\n\n');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Fastest model
        messages: [
          {
            role: "system",
            content: "Summarize in one sentence."
          },
          {
            role: "user",
            content: conversationText
          }
        ],
        temperature: 0.3,
        max_tokens: 50 // Very short summary
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      return 'Recent conversation summary unavailable.';
    }
  }

  // Simplified topic extraction
  async extractTopics(messages) {
    // Extract keywords from recent user messages
    const userMessages = messages
      .filter(msg => msg.role === 'user')
      .slice(-5)
      .map(msg => msg.content)
      .join(' ');
    
    // Just extract frequent words as topics
    const words = userMessages.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Count frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // Get top topics by frequency
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }

  // Simple sentiment scoring without API calls
  async analyzeSentiment(messages) {
    // Positive and negative word lists
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'helpful', 'thanks', 'thank', 'love', 'like', 'best', 'appreciate'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointed', 'disappointing', 'useless', 'hate', 'worst', 'waste', 'difficult', 'problem', 'issue'];
    
    // Only analyze user messages
    const userText = messages
      .filter(msg => msg.role === 'user')
      .slice(-3) // Limit to recent messages
      .map(msg => msg.content.toLowerCase())
      .join(' ');
    
    let score = 0;
    
    // Count positive words
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (userText.match(regex) || []).length;
      score += matches;
    });
    
    // Count negative words
    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (userText.match(regex) || []).length;
      score -= matches;
    });
    
    // Scale to -10 to 10 range
    return Math.max(-10, Math.min(10, score));
  }

  // Generate simple follow-up suggestions without API calls
  async generateFollowUps(messages, topics = []) {
    // Default follow-ups based on common conversation patterns
    const defaultFollowUps = [
      "Can you tell me more about that?",
      "Would you like me to explain anything further?",
      "Is there anything else I can help with today?"
    ];
    
    // If no topics or messages, return defaults
    if (!messages.length || !topics.length) {
      return defaultFollowUps;
    }
    
    // Generate follow-ups based on topics
    const topicBasedFollowUps = topics.slice(0, 3).map(topic => 
      `Would you like more information about ${topic}?`
    );
    
    // Use a mix of generic and topic-based follow-ups
    return [...topicBasedFollowUps, defaultFollowUps[2]];
  }
}

module.exports = new OpenAIService(); 