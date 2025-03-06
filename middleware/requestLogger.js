const Report = require('../models/Report');

/**
 * Middleware to log request details to the Report model
 * This should be placed after the auth middleware to have access to req.user
 */
const requestLogger = async (req, res, next) => {
  // Skip logging for some routes if needed
  const skipLogging = ['/api/auth/login', '/api/auth/register'].includes(req.path);
  
  if (skipLogging) {
    return next();
  }
  
  // Start timer to measure response time
  const start = Date.now();
  
  // Save the original end method
  const originalEnd = res.end;
  
  // Override the end method to capture response data
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - start;
    
    // Restore the original end method
    res.end = originalEnd;
    
    // Call the original end method
    res.end(chunk, encoding);
    
    // Skip logging if user is not authenticated
    if (!req.user) return;
    
    // Determine resource type and ID from URL if possible
    let resourceId = null;
    let resourceModel = null;
    
    // Check URL patterns to identify resource types
    if (req.path.startsWith('/api/documents')) {
      const matches = req.path.match(/\/api\/documents\/([a-f0-9]{24})/);
      if (matches) {
        resourceId = matches[1];
        resourceModel = 'Document';
      }
    } else if (req.path.startsWith('/api/conversations')) {
      const matches = req.path.match(/\/api\/conversations\/([a-f0-9]{24})/);
      if (matches) {
        resourceId = matches[1];
        resourceModel = 'Conversation';
      }
    }
    
    // Create a new report entry
    const reportData = {
      userId: req.user.id,
      endpoint: req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      requestBody: req.method !== 'GET' ? req.body : undefined,
      requestParams: req.params,
      requestQuery: req.query,
      resourceId,
      resourceModel,
      userAgent: req.headers['user-agent'],
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    };
    
    // Save report asynchronously (don't wait for it to complete)
    Report.create(reportData).catch(err => {
      console.error('Error saving request log:', err);
    });
  };
  
  next();
};

module.exports = requestLogger; 