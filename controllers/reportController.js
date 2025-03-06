const asyncHandler = require('../middleware/async');
const reportingService = require('../services/reportingService');

// @desc    Get summary metrics
// @route   GET /api/reports/summary
// @access  Private (Admin)
exports.getSummaryMetrics = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Get userId if specified
  const userId = req.query.userId || null;
  
  const summaryMetrics = await reportingService.getSummaryMetrics(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      metrics: summaryMetrics
    }
  });
});

// @desc    Get endpoint statistics
// @route   GET /api/reports/endpoints
// @access  Private (Admin)
exports.getEndpointStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  const endpointStats = await reportingService.getEndpointStats(startDate, endDate);
  
  res.status(200).json({
    success: true,
    count: endpointStats.length,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      endpoints: endpointStats
    }
  });
});

// @desc    Get user activity statistics
// @route   GET /api/reports/users
// @access  Private (Admin)
exports.getUserActivityStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  const userStats = await reportingService.getUserActivityStats(startDate, endDate);
  
  res.status(200).json({
    success: true,
    count: userStats.length,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      users: userStats
    }
  });
});

// @desc    Get resource usage statistics
// @route   GET /api/reports/resources/:resourceType
// @access  Private (Admin)
exports.getResourceUsageStats = asyncHandler(async (req, res, next) => {
  // Get resource type from URL params
  const resourceType = req.params.resourceType;
  
  // Validate resource type
  if (!['documents', 'conversations'].includes(resourceType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid resource type. Must be "documents" or "conversations".'
    });
  }
  
  // Map URL param to model name
  const resourceModel = resourceType === 'documents' ? 'Document' : 'Conversation';
  
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  const resourceStats = await reportingService.getResourceUsageStats(startDate, endDate, resourceModel);
  
  res.status(200).json({
    success: true,
    count: resourceStats.length,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      resourceType,
      resources: resourceStats
    }
  });
});

// @desc    Get daily usage statistics
// @route   GET /api/reports/daily
// @access  Private (Admin)
exports.getDailyStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  const dailyStats = await reportingService.getDailyStats(startDate, endDate);
  
  res.status(200).json({
    success: true,
    count: dailyStats.length,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      dailyStats
    }
  });
});

// @desc    Get personal user activity statistics
// @route   GET /api/reports/me
// @access  Private
exports.getMyStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Use the current user's ID
  const userId = req.user.id;
  
  const summaryMetrics = await reportingService.getSummaryMetrics(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      metrics: summaryMetrics
    }
  });
}); 