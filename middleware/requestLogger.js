const Report = require('../models/Report');

/**
 * Middleware to log request details to the Report model
 * This should be placed after the auth middleware to have access to req.user
 */
const requestLogger = async (req, res, next) => {
  // Only log requests to the messages endpoint
  const messageMatch = req.path.match(/\/api\/conversations\/([a-f0-9]{24})\/messages/);
  if (!messageMatch) {
    return next();
  }
  
  // Start timer to measure response time
  const start = Date.now();
  
  // Save the original end method
  const originalEnd = res.end;
  
  // Save the initial request body (to capture AI request info)
  const requestBody = { ...req.body };
  
  // Create a placeholder for AI usage data
  let aiUsageData = null;
  
  // Intercept the AI usage data from response locals
  const originalJson = res.json;
  res.json = function(data) {
    // If the response contains AI usage data, capture it
    if (data && data.aiUsage) {
      aiUsageData = data.aiUsage;
      // Optional: Remove usage data from client response
      delete data.aiUsage;
    }
    
    return originalJson.call(this, data);
  };
  
  // Override the end method to capture response data
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - start;
    
    // Restore the original end method
    res.end = originalEnd;
    
    // Call the original end method
    res.end(chunk, encoding);
    
    // Skip logging if user is not authenticated
    if (!req.user) {
      console.log('No user found in request');
      return;
    }
    
    // Extract conversation ID from the URL (safely)
    const conversationId = messageMatch[1];
    
    // Create a new report entry with full endpoint path
    const reportData = {
      userId: req.user.id,
      endpoint: `/api/conversations${req.path}`, // Add the full path prefix
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      requestBody,
      resourceId: conversationId,
      resourceModel: 'Conversation',
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      timestamp: new Date()
    };
    
    // Add AI usage data if available
    if (aiUsageData) {
      reportData.aiUsage = aiUsageData;
    }
    
    console.log('Saving report data:', reportData);
    
    // Save report asynchronously
    Report.create(reportData)
      .then(report => {
        console.log('Report saved:', report);
      })
      .catch(err => console.error('Error saving request log:', err));
  };
  
  next();
};

module.exports = requestLogger; 