const axios = require('axios');
const env = require('../config/env');
const DashboardService = require('./dashboard.service');

// Bộ đệm ngắn hạn (Short-term cache & in-flight promise collapsing)
// Ngăn ngừa việc gửi 4 request n8n đồng thời khi React Frontend gọi Promise.all([getSummary, getBreakdown, ...])
const inFlightRequests = new Map();
const analyticsCache = new Map();
const CACHE_TTL_MS = 2500; // 2.5 giây

/**
 * Gửi HTTP POST tới webhook n8n với cơ chế tự động thử lại fallback /webhook/ <-> /webhook-test/
 */
async function postToN8n(primaryUrl, payload, headers, timeout = 6000) {
  try {
    return await axios.post(primaryUrl, payload, { headers, timeout });
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (primaryUrl.includes('/webhook/')) {
        fallbackUrl = primaryUrl.replace('/webhook/', '/webhook-test/');
      } else if (primaryUrl.includes('/webhook-test/')) {
        fallbackUrl = primaryUrl.replace('/webhook-test/', '/webhook/');
      }

      if (fallbackUrl) {
        console.log(`[DashboardFlowService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, { headers, timeout });
      }
    }
    throw err;
  }
}

class DashboardFlowService {
  /**
   * Xóa bộ nhớ đệm cache (phục vụ unit test và làm mới dữ liệu tức thì)
   */
  static clearCache() {
    analyticsCache.clear();
    inFlightRequests.clear();
  }

  /**
   * Gọi n8n Flow 10 (Dashboard Analytics Workflow) để tổng hợp toàn bộ số liệu thống kê
   * @param {Object} params
   * @param {string} params.userId - UUID của người dùng
   * @param {string} [params.projectId] - UUID của dự án cụ thể
   */
  static async fetchFromFlow10({ userId, projectId = null }) {
    const cacheKey = `${userId}:${projectId || 'all'}`;
    const now = Date.now();

    // 1. Kiểm tra cache ngắn hạn
    const cached = analyticsCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 2. In-flight promise collapsing: Nếu đang có request n8n đang bay, tái sử dụng Promise đó
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
      const webhookUrl = env.N8N_DASHBOARD_WEBHOOK_URL;
      const backendUrl = process.env.BACKEND_INTERNAL_URL || `http://localhost:${env.PORT || 5000}`;
      const internalSecret = env.INTERNAL_SERVICE_KEY;

      const payload = {
        userId,
        projectId: projectId || null,
        requestId: `req-dash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        backendUrl,
        internalSecret,
      };

      const headers = {
        'Content-Type': 'application/json',
      };

      try {
        const response = await postToN8n(webhookUrl, payload, headers, 6000);
        const result = response.data;

        if (result && result.success) {
          const finalData = {
            summary: result.summary || result.data?.summary,
            breakdown: result.breakdown || result.data?.breakdown,
            statusDistribution: result.statusDistribution || result.data?.statusDistribution,
            creationTrend: result.creationTrend || result.data?.creationTrend,
            completionMetrics: result.completionMetrics || result.data?.completionMetrics,
            filteredProject: result.data?.filteredProject || result.summary?.filteredProject || null,
            executionSource: 'n8n-flow-10',
          };

          analyticsCache.set(cacheKey, { timestamp: Date.now(), data: finalData });
          return finalData;
        }

        throw new Error(result?.message || 'n8n Flow 10 không trả về kết quả hợp lệ.');
      } catch (err) {
        // Fallback: Khi n8n không phản hồi hoặc gặp lỗi mạng, gọi trực tiếp DashboardService nội bộ
        console.warn(
          `[DashboardFlowService] n8n Flow 10 không khả dụng (${err.message}). Kích hoạt Local Simulation Engine phục vụ Dashboard an toàn 100%.`
        );

        const [summary, breakdown, statusDistribution, creationTrend] = await Promise.all([
          DashboardService.getSummary({ userId, projectId }),
          DashboardService.getIssueBreakdown({ userId, projectId }),
          DashboardService.getStatusDistribution({ userId, projectId }),
          DashboardService.getCreationTrend({ userId, projectId }),
        ]);

        const fallbackData = {
          summary,
          breakdown,
          statusDistribution,
          creationTrend,
          completionMetrics: {
            totalIssues: summary.totalIssues,
            doneIssues: summary.statusDistribution.done,
            inProgressIssues: summary.statusDistribution.inProgress,
            toDoIssues: summary.statusDistribution.toDo,
            completionRate: summary.completionRate,
            totalStoryPoints: summary.totalStoryPoints || 0,
          },
          filteredProject: summary.filteredProject,
          executionSource: 'backend-direct-fallback',
        };

        analyticsCache.set(cacheKey, { timestamp: Date.now(), data: fallbackData });
        return fallbackData;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Lấy số liệu Summary thông qua Flow 10
   */
  static async getSummary({ userId, projectId }) {
    const data = await this.fetchFromFlow10({ userId, projectId });
    return data.summary;
  }

  /**
   * Lấy phân loại Issue Breakdown thông qua Flow 10
   */
  static async getIssueBreakdown({ userId, projectId }) {
    const data = await this.fetchFromFlow10({ userId, projectId });
    return data.breakdown;
  }

  /**
   * Lấy phân bố trạng thái Status Distribution thông qua Flow 10
   */
  static async getStatusDistribution({ userId, projectId }) {
    const data = await this.fetchFromFlow10({ userId, projectId });
    return data.statusDistribution;
  }

  /**
   * Lấy xu hướng tạo Creation Trend thông qua Flow 10
   */
  static async getCreationTrend({ userId, projectId }) {
    const data = await this.fetchFromFlow10({ userId, projectId });
    return data.creationTrend;
  }

  /**
   * Lấy trọn bộ Analytics Dashboard thông qua Flow 10
   */
  static async getAllAnalytics({ userId, projectId }) {
    return await this.fetchFromFlow10({ userId, projectId });
  }
}

module.exports = DashboardFlowService;
