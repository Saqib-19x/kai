const Report = require('../models/Report');
const User = require('../models/User');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const mongoose = require('mongoose');

class ReportingService {
  /**
   * Get summary metrics for a specific time period
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Object} Summary metrics
   */
  async getSummaryMetrics(startDate, endDate, userId = null) {
    // Convert dates to proper Date objects if they aren't already
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    console.log('Getting metrics for:', {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      userId
    });
    
    const match = {
      timestamp: {
        $gte: start,
        $lte: end
      }
    };
    
    if (userId) {
      // Convert userId string to ObjectId if needed
      match.userId = new mongoose.Types.ObjectId(userId);
    }
    
    console.log('MongoDB match criteria:', match);
    
    // Find all matching documents first for debugging
    const matchingDocs = await Report.find(match);
    console.log('Matching documents:', matchingDocs);
    
    const summary = await Report.aggregate([
      { 
        $match: match 
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          successRequests: {
            $sum: { 
              $cond: [{ $lt: ['$statusCode', 400] }, 1, 0]
            }
          },
          errorRequests: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
            }
          }
        }
      }
    ]).exec();
    
    console.log('Raw aggregation results:', summary);
    
    // Transform the results
    const metrics = summary[0] ? {
      totalRequests: summary[0].totalRequests || 0,
      avgResponseTime: summary[0].avgResponseTime ? Math.round(summary[0].avgResponseTime * 100) / 100 : 0,
      minResponseTime: summary[0].minResponseTime || 0,
      maxResponseTime: summary[0].maxResponseTime || 0,
      successRate: summary[0].totalRequests ? 
        Math.round((summary[0].successRequests / summary[0].totalRequests) * 100 * 100) / 100 : 0,
      errorRate: summary[0].totalRequests ? 
        Math.round((summary[0].errorRequests / summary[0].totalRequests) * 100 * 100) / 100 : 0
    } : {
      totalRequests: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      successRate: 0,
      errorRate: 0
    };
    
    console.log('Processed metrics:', metrics);
    
    // Add agent and chat summary
    const agentStats = await this.getAgentStats(startDate, endDate, userId);
    const chatStats = await this.getChatStats(startDate, endDate, userId);
    
    // Return combined metrics
    return {
      ...metrics,
      agents: {
        totalAgents: agentStats.totalAgents,
        activeAgents: agentStats.activeAgents,
        newAgents: agentStats.newAgents
      },
      chats: {
        totalChats: chatStats.totalChats,
        avgMessagesPerChat: chatStats.avgMessagesPerChat
      }
    };
  }
  
  /**
   * Get endpoint usage statistics
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @returns {Array} Endpoint usage statistics
   */
  async getEndpointStats(startDate, endDate) {
    return await Report.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: { endpoint: '$endpoint', method: '$method' },
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
          successCount: {
            $sum: {
              $cond: [{ $lt: ['$statusCode', 400] }, 1, 0]
            }
          },
          errorCount: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          endpoint: '$_id.endpoint',
          method: '$_id.method',
          count: 1,
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          successRate: {
            $round: [
              { $multiply: [{ $divide: ['$successCount', '$count'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }
  
  /**
   * Get user activity statistics
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @returns {Array} User activity statistics
   */
  async getUserActivityStats(startDate, endDate) {
    return await Report.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: '$userId',
          requestCount: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
          lastActivity: { $max: '$timestamp' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          email: '$user.email',
          role: '$user.role',
          requestCount: 1,
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          lastActivity: 1
        }
      },
      { $sort: { requestCount: -1 } }
    ]);
  }
  
  /**
   * Get resource usage statistics
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} resourceModel Type of resource ('Document' or 'Conversation')
   * @returns {Array} Resource usage statistics
   */
  async getResourceUsageStats(startDate, endDate, resourceModel) {
    return await Report.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate
          },
          resourceModel: resourceModel
        }
      },
      {
        $group: {
          _id: '$resourceId',
          accessCount: { $sum: 1 },
          lastAccessed: { $max: '$timestamp' }
        }
      },
      {
        $sort: { accessCount: -1 }
      },
      { $limit: 50 } // Limit to top 50 resources
    ]);
  }
  
  /**
   * Get daily request statistics
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @returns {Array} Daily request statistics
   */
  async getDailyStats(startDate, endDate) {
    return await Report.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
          successCount: {
            $sum: {
              $cond: [{ $lt: ['$statusCode', 400] }, 1, 0]
            }
          },
          errorCount: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          count: 1,
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          successCount: 1,
          errorCount: 1
        }
      },
      { $sort: { date: 1 } }
    ]);
  }
  
  /**
   * Get OpenAI usage statistics by model
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Array} Usage statistics by model
   */
  async getAiUsageByModel(startDate, endDate, userId = null) {
    const match = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      'aiUsage.model': { $ne: null }
    };
    
    if (userId) {
      match.userId = new mongoose.Types.ObjectId(userId);
    }
    
    return await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$aiUsage.model',
          requestCount: { $sum: 1 },
          totalPromptTokens: { $sum: '$aiUsage.promptTokens' },
          totalCompletionTokens: { $sum: '$aiUsage.completionTokens' },
          totalTokens: { $sum: '$aiUsage.totalTokens' },
          totalCost: { $sum: '$aiUsage.cost' },
          totalCustomerPrice: { $sum: '$aiUsage.customerPrice' }
        }
      },
      {
        $project: {
          _id: 0,
          model: '$_id',
          requestCount: 1,
          totalPromptTokens: 1,
          totalCompletionTokens: 1,
          totalTokens: 1,
          totalCost: { $round: ['$totalCost', 4] },
          totalCustomerPrice: { $round: ['$totalCustomerPrice', 4] },
          profit: { 
            $round: [{ $subtract: ['$totalCustomerPrice', '$totalCost'] }, 4] 
          }
        }
      },
      { $sort: { totalTokens: -1 } }
    ]);
  }
  
  /**
   * Get daily OpenAI usage statistics
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Array} Daily usage statistics
   */
  async getDailyAiUsage(startDate, endDate, userId = null) {
    const match = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      'aiUsage.model': { $ne: null }
    };
    
    if (userId) {
      match.userId = new mongoose.Types.ObjectId(userId);
    }
    
    return await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            model: '$aiUsage.model'
          },
          requestCount: { $sum: 1 },
          totalTokens: { $sum: '$aiUsage.totalTokens' },
          totalCost: { $sum: '$aiUsage.cost' },
          totalCustomerPrice: { $sum: '$aiUsage.customerPrice' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          model: '$_id.model',
          requestCount: 1,
          totalTokens: 1,
          totalCost: { $round: ['$totalCost', 4] },
          totalCustomerPrice: { $round: ['$totalCustomerPrice', 4] },
          profit: { 
            $round: [{ $subtract: ['$totalCustomerPrice', '$totalCost'] }, 4] 
          }
        }
      },
      { $sort: { date: 1, model: 1 } }
    ]);
  }
  
  /**
   * Get user AI usage statistics
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @returns {Array} User usage statistics
   */
  async getUserAiUsage(startDate, endDate) {
    return await Report.aggregate([
      {
        $match: {
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          'aiUsage.model': { $ne: null }
        }
      },
      {
        $group: {
          _id: '$userId',
          requestCount: { $sum: 1 },
          totalTokens: { $sum: '$aiUsage.totalTokens' },
          totalCost: { $sum: '$aiUsage.cost' },
          totalCustomerPrice: { $sum: '$aiUsage.customerPrice' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          email: '$user.email',
          requestCount: 1,
          totalTokens: 1,
          totalCost: { $round: ['$totalCost', 4] },
          totalCustomerPrice: { $round: ['$totalCustomerPrice', 4] },
          profit: { 
            $round: [{ $subtract: ['$totalCustomerPrice', '$totalCost'] }, 4] 
          }
        }
      },
      { $sort: { totalCost: -1 } }
    ]);
  }
  
  /**
   * Get agent statistics for a specific time period
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Object} Agent statistics
   */
  async getAgentStats(startDate, endDate, userId = null) {
    const AgentConfig = require('../models/AgentConfig');
    const Conversation = require('../models/Conversation');
    const mongoose = require('mongoose');
    
    const match = userId ? { user: new mongoose.Types.ObjectId(userId) } : {};
    
    // Get total agents
    const totalAgents = await AgentConfig.countDocuments(match);
    
    // Get agents created in time period
    const newAgentsMatch = { 
      ...match, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } 
    };
    const newAgents = await AgentConfig.countDocuments(newAgentsMatch);
    
    // Get active agents (agents used in conversations during time period)
    const activeAgentIds = await Conversation.distinct('agentConfig', {
      updatedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      ...(userId ? { user: new mongoose.Types.ObjectId(userId) } : {})
    });
    
    return {
      totalAgents,
      newAgents,
      activeAgents: activeAgentIds.length,
      popularAgents: await this.getPopularAgents(startDate, endDate, userId)
    };
  }
  
  /**
   * Get popular agents by usage
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Array} Most used agents
   */
  async getPopularAgents(startDate, endDate, userId = null) {
    const Conversation = require('../models/Conversation');
    const mongoose = require('mongoose');
    
    const matchCriteria = {
      updatedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      agentConfig: { $ne: null }
    };
    
    if (userId) {
      matchCriteria.user = new mongoose.Types.ObjectId(userId);
    }
    
    // Find most used agents
    return await Conversation.aggregate([
      { $match: matchCriteria },
      { $group: {
        _id: '$agentConfig',
        count: { $sum: 1 },
        messageCount: { $sum: { $size: '$messages' } }
      }},
      { $lookup: {
        from: 'agentconfigs',
        localField: '_id',
        foreignField: '_id',
        as: 'agentDetails'
      }},
      { $unwind: '$agentDetails' },
      { $project: {
        _id: 0,
        agentId: '$_id',
        name: '$agentDetails.name',
        model: '$agentDetails.model',
        conversationCount: '$count',
        messageCount: 1
      }},
      { $sort: { conversationCount: -1 } },
      { $limit: 5 }
    ]);
  }
  
  /**
   * Get chat statistics for a specific time period
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Object} Chat statistics
   */
  async getChatStats(startDate, endDate, userId = null) {
    const Conversation = require('../models/Conversation');
    const mongoose = require('mongoose');
    
    const matchCriteria = {
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    
    if (userId) {
      matchCriteria.user = new mongoose.Types.ObjectId(userId);
    }
    
    // Get total chats
    const totalChats = await Conversation.countDocuments(matchCriteria);
    
    // Get average messages per chat
    const chatAnalytics = await Conversation.aggregate([
      { $match: matchCriteria },
      { $project: {
        messageCount: { $size: '$messages' }
      }},
      { $group: {
        _id: null,
        avgMessages: { $avg: '$messageCount' },
        maxMessages: { $max: '$messageCount' }
      }}
    ]);
    
    const avgMessagesPerChat = chatAnalytics.length > 0 
      ? Math.round(chatAnalytics[0].avgMessages * 100) / 100 
      : 0;
    
    // Get daily chat counts
    const dailyChats = await this.getDailyChatCounts(startDate, endDate, userId);
    
    return {
      totalChats,
      avgMessagesPerChat,
      dailyChats
    };
  }
  
  /**
   * Get daily chat counts for graphing
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Array} Daily chat counts
   */
  async getDailyChatCounts(startDate, endDate, userId = null) {
    const Conversation = require('../models/Conversation');
    const mongoose = require('mongoose');
    
    const matchCriteria = {
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    
    if (userId) {
      matchCriteria.user = new mongoose.Types.ObjectId(userId);
    }
    
    return await Conversation.aggregate([
      { $match: matchCriteria },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        messageCount: { $sum: { $size: '$messages' } }
      }},
      { $project: {
        _id: 0,
        date: '$_id',
        chatCount: '$count',
        messageCount: 1
      }},
      { $sort: { date: 1 } }
    ]);
  }
  
  /**
   * Get chat billing information
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Object} Chat billing information
   */
  async getChatBillingInfo(startDate, endDate, userId = null) {
    const Report = require('../models/Report');
    const mongoose = require('mongoose');
    
    // Match criteria for reports involving conversations
    const match = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      resourceModel: 'Conversation',
      'aiUsage.model': { $ne: null }
    };
    
    if (userId) {
      match.userId = new mongoose.Types.ObjectId(userId);
    }
    
    const billingByChat = await Report.aggregate([
      { $match: match },
      { $group: {
        _id: '$resourceId',
        requestCount: { $sum: 1 },
        totalTokens: { $sum: '$aiUsage.totalTokens' },
        totalCost: { $sum: '$aiUsage.cost' },
        totalCustomerPrice: { $sum: '$aiUsage.customerPrice' }
      }},
      { $lookup: {
        from: 'conversations',
        localField: '_id',
        foreignField: '_id',
        as: 'conversation'
      }},
      { $unwind: { path: '$conversation', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0,
        conversationId: '$_id',
        title: { $ifNull: ['$conversation.title', 'Unknown'] },
        messageCount: { $size: { $ifNull: ['$conversation.messages', []] } },
        requestCount: 1,
        totalTokens: 1,
        totalCost: { $round: ['$totalCost', 4] },
        totalCustomerPrice: { $round: ['$totalCustomerPrice', 4] },
        profit: { $round: [{ $subtract: ['$totalCustomerPrice', '$totalCost'] }, 4] }
      }},
      { $sort: { totalTokens: -1 } }
    ]);
    
    // Calculate overall totals
    const totals = billingByChat.reduce((acc, curr) => {
      acc.requestCount += curr.requestCount || 0;
      acc.totalTokens += curr.totalTokens || 0;
      acc.totalCost += curr.totalCost || 0;
      acc.totalCustomerPrice += curr.totalCustomerPrice || 0;
      acc.profit += curr.profit || 0;
      return acc;
    }, { 
      requestCount: 0, 
      totalTokens: 0, 
      totalCost: 0, 
      totalCustomerPrice: 0,
      profit: 0
    });
    
    return {
      chatBilling: billingByChat,
      totals: {
        requestCount: totals.requestCount,
        totalTokens: totals.totalTokens,
        totalCost: parseFloat(totals.totalCost.toFixed(4)),
        totalCustomerPrice: parseFloat(totals.totalCustomerPrice.toFixed(4)),
        profit: parseFloat(totals.profit.toFixed(4))
      }
    };
  }
}

module.exports = new ReportingService(); 