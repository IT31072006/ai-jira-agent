const ConfigService = require('../services/config.service');

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
      return res.status(200).json({
        success: true,
        message: result.message,
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
