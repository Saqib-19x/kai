const elevenLabs = require('./elevenLabsService');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const cache = require('memory-cache');
const { Readable } = require('stream');

class ElevenLabsKnowledgeBaseService {
  constructor() {
    this.basePath = '/v1/knowledge-base';
    this.cacheTime = 5 * 60 * 1000; // 5 minutes
  }

  // Create knowledge base document
  async createKnowledgeBase(formData) {
    try {
      console.log('Sending request to ElevenLabs with formData');

      const response = await elevenLabs.postFormData(this.basePath, formData);
      return response;
    } catch (error) {
      console.error('ElevenLabs API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get all knowledge bases
  async getKnowledgeBases() {
    const cacheKey = 'elevenlabs_knowledge_bases';
    const cachedKBs = cache.get(cacheKey);
    
    if (cachedKBs) return cachedKBs;
    
    const knowledgeBases = await elevenLabs.get(this.basePath);
    cache.put(cacheKey, knowledgeBases, this.cacheTime);
    
    return knowledgeBases;
  }

  // Get knowledge base by ID
  async getKnowledgeBase(knowledgeBaseId) {
    const cacheKey = `elevenlabs_kb_${knowledgeBaseId}`;
    const cachedKB = cache.get(cacheKey);
    
    if (cachedKB) return cachedKB;
    
    const knowledgeBase = await elevenLabs.get(`${this.basePath}/${knowledgeBaseId}`);
    cache.put(cacheKey, knowledgeBase, this.cacheTime);
    
    return knowledgeBase;
  }

  // Update knowledge base
  async updateKnowledgeBase(knowledgeBaseId, data) {
    const response = await elevenLabs.post(`${this.basePath}/${knowledgeBaseId}`, data);
    // Clear cache
    cache.del(`elevenlabs_kb_${knowledgeBaseId}`);
    cache.del('elevenlabs_knowledge_bases');
    
    return response;
  }

  // Delete knowledge base
  async deleteKnowledgeBase(knowledgeBaseId) {
    const response = await elevenLabs.delete(`${this.basePath}/${knowledgeBaseId}`);
    // Clear cache
    cache.del(`elevenlabs_kb_${knowledgeBaseId}`);
    cache.del('elevenlabs_knowledge_bases');
    
    return response;
  }

  // Upload files to knowledge base
  async uploadFiles(knowledgeBaseId, file) {
    try {
      if (!knowledgeBaseId) {
        throw new Error('Knowledge base ID is required');
      }

      const formData = new FormData();
      
      console.log('Uploading file:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      // Append the file
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      // Use the correct endpoint structure
      const endpoint = `${this.basePath}/${knowledgeBaseId}/file`;  // Changed from '/files' to '/file'
      
      console.log('Making request to endpoint:', endpoint);

      const response = await elevenLabs.postFormData(endpoint, formData);
      
      return response;
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  // Get files in knowledge base
  async getFiles(knowledgeBaseId) {
    return await elevenLabs.get(`${this.basePath}/${knowledgeBaseId}/files`);
  }

  // Delete file from knowledge base
  async deleteFile(knowledgeBaseId, fileId) {
    return await elevenLabs.delete(`${this.basePath}/${knowledgeBaseId}/files/${fileId}`);
  }
}

module.exports = new ElevenLabsKnowledgeBaseService(); 