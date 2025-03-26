const Document = require('../models/Document');
const documentProcessor = require('../services/documentProcessor');
const asyncHandler = require('../middleware/async');
const path = require('path');
const openaiService = require('../services/openaiService');
const AgentConfig = require('../models/AgentConfig');

// @desc    Upload a new document
// @route   POST /api/documents/upload
// @access  Public
exports.uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Please upload a file'
    });
  }

  // Check if agentId is provided
  if (!req.body.agentId) {
    return res.status(400).json({
      success: false,
      error: 'Please provide an agent ID'
    });
  }

  // Verify agent exists and user has access
  const agent = await AgentConfig.findById(req.body.agentId);
  if (!agent) {
    return res.status(400).json({
      success: false,
      error: 'Agent not found'
    });
  }

  // Check if user has access to the agent
  if (agent.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to upload documents to this agent'
    });
  }

  // Create document in database with agent reference
  const document = await Document.create({
    fileName: req.file.filename,
    originalName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    filePath: req.file.path,
    agent: req.body.agentId,
    user: req.user.id  // Also store the user who uploaded it
  });

  // Start processing the document in the background
  documentProcessor.processDocument(document._id)
    .catch(error => console.error(`Error processing document ${document._id}:`, error));

  res.status(201).json({
    success: true,
    data: document
  });
});

// @desc    Get document by ID
// @route   GET /api/documents/:id
// @access  Public
exports.getDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);
  
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Get all documents
// @route   GET /api/documents
// @access  Public
exports.getAllDocuments = asyncHandler(async (req, res, next) => {
  let query = {};
  
  // Filter by agent if agentId is provided
  if (req.query.agentId) {
    query.agent = req.query.agentId;
  }

  // Only show documents the user has access to
  if (req.user.role !== 'admin') {
    const accessibleAgents = await AgentConfig.find({
      $or: [
        { user: req.user.id },
        { isPublic: true }
      ]
    });
    query.agent = { $in: accessibleAgents.map(agent => agent._id) };
  }

  const documents = await Document.find(query)
    .populate('agent', 'name')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: documents.length,
    data: documents
  });
});

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Public
exports.deleteDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);
  
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  await document.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Ask a question about a document
// @route   POST /api/documents/:id/ask
// @access  Public
exports.askDocumentQuestion = asyncHandler(async (req, res, next) => {
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a question'
    });
  }
  
  // Get document
  const document = await Document.findById(req.params.id);
  
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  // Check if document has been processed
  if (document.processingStatus !== 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Document is still being processed'
    });
  }
  
  try {
    // Get relevant context
    let context = '';
    
    // If document has chunks, find relevant ones
    if (document.chunks && document.chunks.length > 0) {
      const queryKeywords = question.toLowerCase()
        .match(/\b[a-z]{3,}\b/g) || [];
      
      // Score chunks based on keyword matches
      const scoredChunks = document.chunks.map(chunk => {
        const chunkText = chunk.text.toLowerCase();
        let score = 0;
        
        queryKeywords.forEach(keyword => {
          if (chunkText.includes(keyword)) {
            score += 1;
          }
        });
        
        return { ...chunk.toObject(), score };
      });
      
      // Get top chunks
      scoredChunks.sort((a, b) => b.score - a.score);
      const topChunks = scoredChunks.slice(0, 3);
      
      // Combine context
      context = topChunks.map(chunk => chunk.text).join('\n\n');
    } else {
      // If no chunks, use the full text if it's not too long
      context = document.extractedText.length > 10000 
        ? document.extractedText.substring(0, 10000) + '...' 
        : document.extractedText;
    }
    
    // Create prompt for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant answering questions about a document. 
        Below is the relevant content from the document titled "${document.fileName}".
        
        Document content:
        ${context}
        
        Answer questions based only on the information provided above. If the answer is not in the document, say "I don't see information about that in the document."`
      },
      {
        role: 'user',
        content: question
      }
    ];
    
    // Get AI response
    const responseData = await openaiService.getChatCompletion(messages);
    
    res.status(200).json({
      success: true,
      data: {
        question,
        answer: responseData.content,
        documentTitle: document.fileName,
        aiUsage: responseData.usage
      }
    });
  } catch (error) {
    console.error('Error getting document answer:', error);
    return res.status(500).json({
      success: false,
      error: 'Error generating answer'
    });
  }
});

// @desc    Generate a summary of a document
// @route   POST /api/documents/:id/summarize
// @access  Public
exports.summarizeDocument = asyncHandler(async (req, res, next) => {
  // Get document
  const document = await Document.findById(req.params.id);
  
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  // Check if document has been processed
  if (document.processingStatus !== 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Document is still being processed'
    });
  }
  
  try {
    // Extract most important parts of document (first and last sections are often important)
    let textToSummarize = document.extractedText;
    
    // If text is too long, take strategic parts
    if (textToSummarize.length > 10000) {
      const chunks = textToSummarize.split('\n\n');
      
      // Take beginning, some middle parts, and end
      const beginning = chunks.slice(0, 3).join('\n\n');
      
      // Take some sections from the middle
      const middleOffset = Math.floor(chunks.length / 2);
      const middle = chunks.slice(middleOffset, middleOffset + 3).join('\n\n');
      
      // Take end sections
      const end = chunks.slice(chunks.length - 3).join('\n\n');
      
      textToSummarize = [beginning, middle, end].join('\n\n...\n\n');
    }
    
    // Create prompt for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are a professional summarizer. Create a concise but comprehensive summary of the following document. Include the main points, key findings, and any important details. Format the summary with appropriate headings and bullet points where relevant.`
      },
      {
        role: 'user',
        content: `Please summarize this document titled "${document.fileName}":\n\n${textToSummarize}`
      }
    ];
    
    // Get AI response
    const responseData = await openaiService.getChatCompletion(messages, {
      model: 'gpt-4', // Use GPT-4 for better summarization
      max_tokens: 1000
    });
    
    // Save summary to document
    document.summary = responseData.content;
    await document.save();
    
    res.status(200).json({
      success: true,
      data: {
        documentId: document._id,
        documentTitle: document.fileName,
        summary: document.summary,
        aiUsage: responseData.usage
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Error generating document summary'
    });
  }
}); 