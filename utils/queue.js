const Queue = require('bull');
const mongoose = require('mongoose');
const Document = require('../models/Document');

/**
 * Document processing queue implementation
 */
class DocumentProcessingQueue {
  constructor() {
    this.queue = new Queue('document-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    // Process jobs one at a time
    this.queue.process(async (job) => {
      const { documentId } = job.data;
      
      try {
        // Connect to database if not connected
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(process.env.MONGODB_URI);
        }
        
        const documentProcessor = require('../services/documentProcessor');
        await documentProcessor.processDocument(documentId);
        
        return { success: true, documentId };
      } catch (error) {
        console.error(`Error processing document ${documentId}:`, error);
        
        // Update document with error
        const document = await Document.findById(documentId);
        if (document) {
          document.processingStatus = 'failed';
          document.processingError = error.message;
          await document.save();
        }
        
        throw error; // Let Bull handle the error
      }
    });
    
    // Handle failed jobs
    this.queue.on('failed', (job, error) => {
      console.error(`Job ${job.id} failed:`, error);
    });
    
    console.log('Document processing queue initialized');
  }
  
  /**
   * Add document to processing queue
   * @param {string} documentId Document ID to process
   */
  async addDocument(documentId) {
    return this.queue.add({ documentId }, { 
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true
    });
  }
}

module.exports = {
  DocumentProcessingQueue
}; 