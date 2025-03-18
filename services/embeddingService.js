const { OpenAI } = require('openai');
const mongoose = require('mongoose');
const Document = require('../models/Document');

class EmbeddingService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.embeddingModel = 'text-embedding-3-small'; // Lower cost, good performance
  }
  
  /**
   * Generate embeddings for text
   * @param {string} text Text to embed
   * @returns {Promise<Array>} Vector embedding
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float'
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
  
  /**
   * Generate and store embeddings for document chunks
   * @param {string} documentId Document ID
   */
  async processDocumentEmbeddings(documentId) {
    const document = await Document.findById(documentId);
    if (!document || !document.chunks || document.chunks.length === 0) {
      throw new Error('Document not found or chunks not available');
    }
    
    const updatedChunks = [];
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < document.chunks.length; i++) {
      const chunk = document.chunks[i];
      
      // Skip if already has embedding
      if (chunk.embedding && chunk.embedding.length > 0) {
        updatedChunks.push(chunk);
        continue;
      }
      
      try {
        // Generate embedding for this chunk
        const embedding = await this.generateEmbedding(chunk.text);
        
        // Add embedding to chunk
        updatedChunks.push({
          ...chunk.toObject(),
          embedding
        });
        
        // Avoid hitting rate limits
        if (i < document.chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Error processing chunk ${i} for document ${documentId}:`, error);
        // Add without embedding if error occurs
        updatedChunks.push(chunk);
      }
    }
    
    // Update document with embeddings
    document.chunks = updatedChunks;
    await document.save();
    
    return document;
  }
  
  /**
   * Find relevant chunks using vector similarity
   * @param {string} query User query
   * @param {Array} documentIds Array of document IDs to search
   * @param {number} limit Maximum number of chunks to return
   * @returns {Promise<Array>} Relevant document chunks
   */
  async findRelevantChunks(query, documentIds, limit = 5) {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Find documents with embeddings
    const documents = await Document.find({
      _id: { $in: documentIds },
      'chunks.embedding': { $exists: true }
    });
    
    if (!documents || documents.length === 0) {
      return [];
    }
    
    // Calculate similarity for each chunk
    let allChunks = [];
    
    for (const doc of documents) {
      for (const chunk of doc.chunks) {
        if (!chunk.embedding || chunk.embedding.length === 0) continue;
        
        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        
        allChunks.push({
          documentId: doc._id,
          documentTitle: doc.fileName,
          chunkId: chunk._id,
          text: chunk.text,
          similarity
        });
      }
    }
    
    // Sort by similarity and get top results
    allChunks.sort((a, b) => b.similarity - a.similarity);
    return allChunks.slice(0, limit);
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * @param {Array} vector1 First vector
   * @param {Array} vector2 Second vector
   * @returns {number} Similarity score (0-1)
   */
  cosineSimilarity(vector1, vector2) {
    if (!vector1 || !vector2 || vector1.length !== vector2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }
}

module.exports = new EmbeddingService(); 