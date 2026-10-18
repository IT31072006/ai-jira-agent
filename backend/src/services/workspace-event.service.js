const axios = require('axios');
const env = require('../config/env');

/**
 * Gửi HTTP POST tới n8n webhook với cơ chế tự động fallback giữa /webhook/ và /webhook-test/
 */
async function postToN8n(primaryUrl, payload, headers, timeout = 5000) {
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
        return await axios.post(fallbackUrl, payload, { headers, timeout });
      }
    }
    throw err;
  }
}

class WorkspaceEventService {
  /**
   * Phát sự kiện quản lý workspace/project sang n8n Flow 2
   * Không bao giờ ném lỗi ra ngoài để đảm bảo tính sẵn sàng của CRUD nghiệp vụ
   */
  static async emitEvent({
    eventType,
    userId,
    workspaceId = null,
    workspaceName = null,
    description = null,
    metadata = {},
  }) {
    const webhookUrl = env.N8N_WORKSPACE_WEBHOOK_URL;
    if (!webhookUrl) {
      return {
        dispatched: false,
        reason: 'N8N_WORKSPACE_WEBHOOK_URL chưa được cấu hình.',
      };
    }

    const payload = {
      eventType,
      userId,
      workspaceId: workspaceId || null,
      workspaceName: workspaceName || null,
      description: description || null,
      timestamp: new Date().toISOString(),
      requestId: `req-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actionBy: {
        userId,
      },
      metadata: metadata || {},
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (env.N8N_WEBHOOK_SECRET) {
      headers['X-Webhook-Secret'] = env.N8N_WEBHOOK_SECRET;
    }

    try {
      const response = await postToN8n(webhookUrl, payload, headers, 5000);
      return {
        dispatched: true,
        deliveredAt: new Date().toISOString(),
        responseData: response.data,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Lỗi kết nối n8n';
      console.warn(
        `[WorkspaceEventService] Không thể gửi sự kiện [${eventType}] sang n8n: ${errorMsg}. Dữ liệu PostgreSQL vẫn được cập nhật an toàn.`
      );
      return {
        dispatched: false,
        reason: errorMsg,
      };
    }
  }
}

module.exports = WorkspaceEventService;
