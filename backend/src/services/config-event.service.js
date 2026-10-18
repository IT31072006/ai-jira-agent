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

class ConfigEventService {
  /**
   * Phát sự kiện cấu hình bảo mật / kiểm tra kết nối sang n8n Flow 3
   * TUYỆT ĐỐI không chứa secret (token, api key, password) trong payload sự kiện.
   */
  static async emitEvent({
    eventType, // 'CONFIG_SAVED' | 'CONNECTION_TEST_REQUESTED' | 'CONFIG_DELETED'
    userId,
    configId = null,
    provider = 'JIRA', // 'JIRA' | 'GEMINI'
    status = 'PENDING',
    metadata = {},
  }) {
    const webhookUrl = env.N8N_CONFIG_WEBHOOK_URL;
    if (!webhookUrl) {
      return {
        dispatched: false,
        reason: 'N8N_CONFIG_WEBHOOK_URL chưa được cấu hình.',
      };
    }

    // Payload chỉ chứa metadata đã được lọc sạch hoàn toàn secrets
    const payload = {
      eventType,
      userId: String(userId),
      configId: configId ? String(configId) : String(userId),
      provider: String(provider).toUpperCase(),
      status: String(status).toUpperCase(),
      timestamp: new Date().toISOString(),
      requestId: `req-cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metadata: {
        ...metadata,
      },
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
      const errorMsg = error.response?.data?.message || error.message || 'Lỗi kết nối n8n webhook';
      console.warn(
        `[ConfigEventService] Không thể gửi sự kiện [${eventType}] sang n8n: ${errorMsg}. CSDL PostgreSQL đã lưu cấu hình an toàn.`
      );
      return {
        dispatched: false,
        reason: errorMsg,
      };
    }
  }
}

module.exports = ConfigEventService;
