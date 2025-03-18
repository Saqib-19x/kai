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
  // Get query parameters for date range, default to last 24 hours from now
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
    
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before endDate
  
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

// @desc    Get AI usage by model
// @route   GET /api/reports/ai-usage
// @access  Private (Admin)
exports.getAiUsage = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Get userId if specified
  const userId = req.query.userId || null;
  
  const usageStats = await reportingService.getAiUsageByModel(startDate, endDate, userId);
  
  // Calculate totals
  const totals = usageStats.reduce((acc, curr) => {
    acc.requestCount += curr.requestCount;
    acc.totalTokens += curr.totalTokens;
    acc.totalCost += curr.totalCost;
    acc.totalCustomerPrice += curr.totalCustomerPrice;
    acc.profit += curr.profit;
    return acc;
  }, { 
    requestCount: 0, 
    totalTokens: 0, 
    totalCost: 0, 
    totalCustomerPrice: 0,
    profit: 0
  });
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      models: usageStats,
      totals: {
        requestCount: totals.requestCount,
        totalTokens: totals.totalTokens,
        totalCost: parseFloat(totals.totalCost.toFixed(4)),
        totalCustomerPrice: parseFloat(totals.totalCustomerPrice.toFixed(4)),
        profit: parseFloat(totals.profit.toFixed(4))
      }
    }
  });
});

// @desc    Get daily AI usage
// @route   GET /api/reports/ai-usage/daily
// @access  Private (Admin)
exports.getDailyAiUsage = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Get userId if specified
  const userId = req.query.userId || null;
  
  const dailyStats = await reportingService.getDailyAiUsage(startDate, endDate, userId);
  
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

// @desc    Get user AI usage
// @route   GET /api/reports/ai-usage/users
// @access  Private (Admin)
exports.getUserAiUsage = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  const userStats = await reportingService.getUserAiUsage(startDate, endDate);
  
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

// @desc    Get my AI usage
// @route   GET /api/reports/me/ai-usage
// @access  Private
exports.getMyAiUsage = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Use the current user's ID
  const userId = req.user.id;
  
  // Get usage stats from the service
  const usageStats = await reportingService.getAiUsageByModel(startDate, endDate, userId);
  const dailyStats = await reportingService.getDailyAiUsage(startDate, endDate, userId);
  
  // Filter out cost and profit information for customer view
  const customerModelStats = usageStats.map(model => ({
    model: model.model,
    requestCount: model.requestCount,
    totalTokens: model.totalTokens,
    totalPrice: model.totalCustomerPrice // Only show the price customer pays
  }));
  
  const customerDailyStats = dailyStats.map(day => ({
    date: day.date,
    model: day.model,
    requestCount: day.requestCount,
    totalTokens: day.totalTokens,
    totalPrice: day.totalCustomerPrice // Only show the price customer pays
  }));
  
  // Calculate totals
  const totals = usageStats.reduce((acc, curr) => {
    acc.requestCount += curr.requestCount;
    acc.totalTokens += curr.totalTokens;
    acc.totalPrice += curr.totalCustomerPrice;
    return acc;
  }, { 
    requestCount: 0, 
    totalTokens: 0, 
    totalPrice: 0
  });
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      models: customerModelStats,
      dailyStats: customerDailyStats,
      totals: {
        requestCount: totals.requestCount,
        totalTokens: totals.totalTokens,
        totalPrice: parseFloat(totals.totalPrice.toFixed(4))
      }
    }
  });
});

// @desc    Get agent statistics
// @route   GET /api/reports/agents
// @access  Private (Admin)
exports.getAgentStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Get userId if specified
  const userId = req.query.userId || null;
  
  const agentStats = await reportingService.getAgentStats(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      ...agentStats
    }
  });
});

// @desc    Get chat statistics
// @route   GET /api/reports/chats
// @access  Private (Admin)
exports.getChatStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Get userId if specified
  const userId = req.query.userId || null;
  
  const chatStats = await reportingService.getChatStats(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      ...chatStats
    }
  });
});

// @desc    Get chat billing information
// @route   GET /api/reports/chats/billing
// @access  Private (Admin)
exports.getChatBillingInfo = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Get userId if specified
  const userId = req.query.userId || null;
  
  const billingInfo = await reportingService.getChatBillingInfo(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    count: billingInfo.chatBilling.length,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      ...billingInfo
    }
  });
});

// @desc    Get my chat statistics
// @route   GET /api/reports/me/chats
// @access  Private
exports.getMyChatStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Use the current user's ID
  const userId = req.user.id;
  
  const chatStats = await reportingService.getChatStats(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      ...chatStats
    }
  });
});

// @desc    Get my chat billing information
// @route   GET /api/reports/me/billing
// @access  Private
exports.getMyChatBillingInfo = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Use the current user's ID
  const userId = req.user.id;
  
  const billingInfo = await reportingService.getChatBillingInfo(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    count: billingInfo.chatBilling.length,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      ...billingInfo
    }
  });
});

// @desc    Get my complete dashboard statistics
// @route   GET /api/reports/me/dashboard
// @access  Private
exports.getMyDashboardStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Use the current user's ID
  const userId = req.user.id;
  
  // Get all stats in parallel for efficiency
  const [summaryMetrics, chatStats, agentStats, billingInfo] = await Promise.all([
    reportingService.getSummaryMetrics(startDate, endDate, userId),
    reportingService.getChatStats(startDate, endDate, userId),
    reportingService.getAgentStats(startDate, endDate, userId),
    reportingService.getChatBillingInfo(startDate, endDate, userId)
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      summary: summaryMetrics,
      chats: chatStats,
      agents: agentStats,
      billing: {
        totals: billingInfo.totals,
        dailyChats: chatStats.dailyChats
      }
    }
  });
});

// @desc    Get my agent statistics
// @route   GET /api/reports/me/agents
// @access  Private
exports.getMyAgentStats = asyncHandler(async (req, res, next) => {
  // Get query parameters for date range
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const endDate = req.query.endDate 
    ? new Date(req.query.endDate) 
    : new Date();
  
  // Use the current user's ID
  const userId = req.user.id;
  
  const agentStats = await reportingService.getAgentStats(startDate, endDate, userId);
  
  res.status(200).json({
    success: true,
    data: {
      timeframe: {
        startDate,
        endDate
      },
      ...agentStats
    }
  });
}); 