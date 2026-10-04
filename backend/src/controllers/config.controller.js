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
}

module.exports = ConfigController;
