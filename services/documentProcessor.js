const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const path = require('path');
const Document = require('../models/Document');
const { DocumentProcessingQueue } = require('../utils/queue');

class DocumentProcessor {
  constructor() {
    this.processingQueue = new DocumentProcessingQueue();
    this.supportedLanguages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'ara'];
    this.documentCache = new Map();
  }
  
  /**
   * Process a document to extract text based on file type
   * @param {string} documentId MongoDB document ID
   */
  async processDocument(documentId) {
    try {
      // Find the document in database
      const document = await Document.findById(documentId);
      
      if (!document) {
        throw new Error(`Document with ID ${documentId} not found`);
      }
      
      // Update document status to processing
      document.processingStatus = 'processing';
      await document.save();
      
      let extractedText = '';
      const filePath = document.filePath;
      const fileType = document.fileType;
      
      // Process based on file type
      if (fileType === 'application/pdf') {
        extractedText = await this.extractTextFromPDF(filePath, document.languageHint || 'eng');
      } else if (fileType.startsWith('image/')) {
        extractedText = await this.extractTextFromImage(filePath, document.languageHint || 'eng');
      } else if (fileType === 'text/plain' || fileType === 'text/csv') {
        extractedText = await this.extractTextFromTextFile(filePath);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                fileType === 'application/msword') {
        extractedText = await this.extractTextFromWord(filePath);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      // Process the extracted text
      const processedText = await this.processExtractedText(extractedText);
      
      // Update document with extracted text
      document.extractedText = processedText;
      document.processingStatus = 'completed';
      document.textLength = processedText.length;
      document.processingCompletedAt = new Date();
      await document.save();
      
      // Index document for search
      await this.indexDocumentForSearch(document);
      
      return document;
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      
      // Update document with error status
      const document = await Document.findById(documentId);
      if (document) {
        document.processingStatus = 'failed';
        document.processingError = error.message;
        await document.save();
      }
      
      throw error;
    }
  }
  
  /**
   * Extract text from PDF file
   * @param {string} filePath Path to the PDF file
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromPdf(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Error extracting text from PDF: ${error.message}`);
    }
  }
  
  /**
   * Extract text from image using OCR
   * @param {string} filePath Path to the image file
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromImage(filePath) {
    try {
      const result = await Tesseract.recognize(filePath, 'eng');
      return result.data.text;
    } catch (error) {
      throw new Error(`Error extracting text from image: ${error.message}`);
    }
  }
  
  /**
   * Extract text from a text file
   * @param {string} filePath Path to the text file
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromTxt(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      return text;
    } catch (error) {
      throw new Error(`Error extracting text from text file: ${error.message}`);
    }
  }
  
  /**
   * Process extracted text to improve quality
   * @param {string} text Raw extracted text
   * @returns {string} Processed text
   */
  async processExtractedText(text) {
    // Remove duplicate whitespace
    let processed = text.replace(/\s+/g, ' ');
    
    // Fix common OCR errors
    processed = processed.replace(/[¡|l]/g, 'i');
    processed = processed.replace(/[0O]/g, 'o');
    
    // Remove headers/footers (basic implementation)
    const lines = processed.split('\n');
    if (lines.length > 10) {
      // Remove first and last lines if they're short (likely headers/footers)
      if (lines[0].length < 50) lines.shift();
      if (lines[lines.length - 1].length < 50) lines.pop();
    }
    
    return lines.join('\n');
  }
  
  /**
   * Index document for search
   * @param {Object} document Document object
   */
  async indexDocumentForSearch(document) {
    // This will be expanded in a later phase with vector search
    // For now, implement basic keyword indexing
    const keywords = this.extractKeywords(document.extractedText);
    document.searchKeywords = keywords;
    await document.save();
  }
  
  /**
   * Extract important keywords from text
   * @param {string} text Text to extract keywords from
   * @returns {Array} List of keywords
   */
  extractKeywords(text) {
    // Simple keyword extraction based on term frequency
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const wordCounts = {};
    
    words.forEach(word => {
      if (!this.isStopWord(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
    
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(entry => entry[0]);
  }
  
  /**
   * Check if word is a stop word
   * @param {string} word Word to check
   * @returns {boolean} True if stop word
   */
  isStopWord(word) {
    const stopWords = ['the', 'and', 'this', 'that', 'with', 'from', 'have', 'for'];
    return stopWords.includes(word);
  }
}

module.exports = new DocumentProcessor(); 