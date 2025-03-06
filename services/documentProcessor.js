const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const path = require('path');
const Document = require('../models/Document');

class DocumentProcessor {
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
        extractedText = await this.extractTextFromPdf(filePath);
      } else if (fileType.startsWith('image/')) {
        extractedText = await this.extractTextFromImage(filePath);
      } else if (fileType === 'text/plain') {
        extractedText = await this.extractTextFromTxt(filePath);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      // Update document with extracted text
      document.extractedText = extractedText;
      document.processingStatus = 'completed';
      await document.save();
      
      return document;
    } catch (error) {
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
}

module.exports = new DocumentProcessor(); 