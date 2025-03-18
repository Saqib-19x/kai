const axios = require('axios');
const cheerio = require('cheerio');
const Document = require('../models/Document');
const openaiService = require('./openaiService');

class KnowledgeSourceService {
  /**
   * Get content from a knowledge source
   * @param {Object} source The knowledge source object
   * @returns {Promise<String>} The extracted content
   */
  async getSourceContent(source) {
    switch (source.sourceType) {
      case 'document':
        return this.getDocumentContent(source.sourceId);
      case 'website':
        return this.getWebsiteContent(source.url);
      case 'text':
      case 'qa':
        return source.content;
      default:
        throw new Error(`Unsupported source type: ${source.sourceType}`);
    }
  }

  /**
   * Get content from a document
   * @param {String} documentId The document ID
   * @returns {Promise<String>} The document content
   */
  async getDocumentContent(documentId) {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    return document.extractedText || '';
  }

  /**
   * Get content from a website
   * @param {String} url The website URL
   * @returns {Promise<String>} The website content
   */
  async getWebsiteContent(url) {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style').remove();
      
      // Get text content
      const text = $('body').text()
        .replace(/\s+/g, ' ')
        .trim();
      
      return text;
    } catch (error) {
      console.error(`Error fetching website content from ${url}:`, error);
      throw new Error(`Failed to fetch website content: ${error.message}`);
    }
  }

  /**
   * Get relevant context from knowledge sources based on a query
   * @param {String} query The user query
   * @param {Array} sources Array of knowledge sources
   * @returns {Promise<String>} Relevant context
   */
  async getRelevantContext(query, sources) {
    if (!sources || sources.length === 0) {
      return '';
    }
    
    let allContexts = [];
    
    // Get content from each source
    for (const source of sources) {
      try {
        const content = await this.getSourceContent(source);
        
        // Use openaiService to get relevant chunks
        if (source.sourceType === 'document') {
          const relevantChunks = await openaiService.ultraFastContextRetrieval(query, source.sourceId);
          if (relevantChunks) {
            allContexts.push(relevantChunks);
          }
        } else if (source.sourceType === 'website') {
          // For websites, use a simple keyword matching approach
          const keywords = openaiService.extractKeywordsFromQuery(query);
          const paragraphs = content.split(/\n\n|\.\s/).filter(p => p.length > 20);
          
          const relevantParagraphs = paragraphs
            .map(p => {
              const score = keywords.reduce((acc, kw) => {
                return acc + (p.toLowerCase().includes(kw.toLowerCase()) ? 1 : 0);
              }, 0);
              return { text: p, score };
            })
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(p => p.text);
          
          if (relevantParagraphs.length > 0) {
            allContexts.push(`From website ${source.url}:\n${relevantParagraphs.join('\n\n')}`);
          }
        } else if (content) {
          // For text and QA sources, use the content directly
          allContexts.push(`From ${source.sourceType} source:\n${content}`);
        }
      } catch (error) {
        console.error(`Error getting content from source ${source.sourceType}:`, error);
      }
    }
    
    return allContexts.join('\n\n');
  }
}

module.exports = new KnowledgeSourceService(); 