const ConfigService = require('../services/config.service');
const ConfigEventService = require('../services/config-event.service');

class ConfigController {
  static async get(req, res, next) {
    try {
      const userId = req.user.id;
      const data = await ConfigService.getConfig(userId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      // User ID strictly retrieved from authenticated JWT token
      const userId = req.user.id;
      const data = await ConfigService.saveConfig(userId, req.body);

      // Xác định provider được cập nhật để phát sự kiện sang n8n Flow 3 (không gửi secret)
      let provider = 'JIRA';
      if (req.body.gemini_api_key && !req.body.jira_api_token && !req.body.jira_domain) {
        provider = 'GEMINI';
      }

      ConfigEventService.emitEvent({
        eventType: 'CONFIG_SAVED',
        userId,
        configId: data.id || userId,
        provider,
        status: 'SAVED',
        metadata: {
          hasJiraDomain: Boolean(data.jira_domain),
          isJiraConfigured: Boolean(data.jira_api_token_configured),
          isGeminiConfigured: Boolean(data.gemini_api_key_configured),
        },
      }).catch((e) => console.warn('[ConfigController] emitEvent error:', e.message));

      return res.status(200).json({
        success: true,
        message: 'Cấu hình đã được lưu thành công.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const userId = req.user.id;
      const { type } = req.query;
      const result = await ConfigService.deleteConfig(userId, type);

      ConfigEventService.emitEvent({
        eventType: 'CONFIG_DELETED',
        userId,
        configId: userId,
        provider: type === 'gemini' ? 'GEMINI' : 'JIRA',
        status: 'DELETED',
      }).catch((e) => console.warn('[ConfigController] emitEvent error:', e.message));

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint kiểm tra kết nối an toàn từ Backend và phát sự kiện sang n8n
   * POST /api/config/test-connection
   */
  static async testConnection(req, res, next) {
    try {
      const userId = req.user.id;
      const { provider = 'JIRA' } = req.body;
      const normalizedProvider = provider.toUpperCase() === 'GEMINI' ? 'GEMINI' : 'JIRA';

      const config = await ConfigService.getConfig(userId);
      let isConfigured = false;
      let checkDetail = '';

      if (normalizedProvider === 'JIRA') {
        isConfigured = Boolean(config.jira_api_token_configured && config.jira_domain && config.jira_email);
        checkDetail = isConfigured
          ? `Tài khoản ${config.jira_email} tại domain ${config.jira_domain} đã sẵn sàng.`
          : 'Chưa cấu hình đầy đủ Jira Domain, Email hoặc API Token.';
      } else {
        isConfigured = Boolean(config.gemini_api_key_configured);
        checkDetail = isConfigured
          ? 'Google Gemini API Key đã được mã hóa và sẵn sàng trong hệ thống.'
          : 'Chưa cấu hình Gemini API Key.';
      }

      const eventResult = await ConfigEventService.emitEvent({
        eventType: 'CONNECTION_TEST_REQUESTED',
        userId,
        configId: userId,
        provider: normalizedProvider,
        status: isConfigured ? 'READY' : 'INCOMPLETE',
        metadata: {
          isConfigured,
          provider: normalizedProvider,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Đã tiếp nhận yêu cầu kiểm tra kết nối dịch vụ ${normalizedProvider}.`,
        provider: normalizedProvider,
        isConfigured,
        detail: checkDetail,
        n8nDispatched: eventResult.dispatched,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint gửi thông báo thử nghiệm (Flow 11)
   * POST /api/config/test-notification
   */
  static async testNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { channel } = req.body;
      const NotificationService = require('../services/notification.service');
      const result = await NotificationService.sendTestNotification(userId, channel);
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint lấy lịch sử gửi thông báo (Flow 11)
   * GET /api/config/notifications/history
   */
  static async getNotificationHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit, 10) || 20;
      const NotificationService = require('../services/notification.service');
      const history = await NotificationService.getHistory(userId, limit);
      return res.status(200).json({
        success: true,
        count: history.length,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ConfigController;
