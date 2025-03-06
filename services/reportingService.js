const Report = require('../models/Report');
const User = require('../models/User');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');

class ReportingService {
  /**
   * Get summary metrics for a specific time period
   * @param {Date} startDate Beginning of period
   * @param {Date} endDate End of period
   * @param {String} userId Optional user ID to filter by
   * @returns {Object} Summary metrics
   */
  async getSummaryMetrics(startDate, endDate, userId = null) {
    const match = {
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (userId) {
      match.userId = userId;
    }
    
    const summary = await Report.aggregate([
      { $match: match },
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
      },
      {
        $project: {
          _id: 0,
          totalRequests: 1,
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          minResponseTime: 1,
          maxResponseTime: 1,
          successRate: {
            $round: [
              { $multiply: [{ $divide: ['$successRequests', '$totalRequests'] }, 100] },
              2
            ]
          },
          errorRate: {
            $round: [
              { $multiply: [{ $divide: ['$errorRequests', '$totalRequests'] }, 100] },
              2
            ]
          }
        }
      }
    ]);
    
    return summary[0] || {
      totalRequests: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      successRate: 0,
      errorRate: 0
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
}

module.exports = new ReportingService(); 