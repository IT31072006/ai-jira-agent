const DashboardService = require('../services/dashboard.service');

class DashboardController {
  /**
   * GET /api/dashboard/summary
   * Tổng quan số liệu thống kê Dashboard
   */
  static async getSummary(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      const summary = await DashboardService.getSummary({ userId, projectId });

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/issue-breakdown
   * Phân loại số lượng Epic, Story, Task theo tháng và toàn thời gian
   */
  static async getIssueBreakdown(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      const breakdown = await DashboardService.getIssueBreakdown({ userId, projectId });

      return res.status(200).json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/status-distribution
   * Phân bố trạng thái issue và tỷ lệ hoàn thành
   */
  static async getStatusDistribution(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      const distribution = await DashboardService.getStatusDistribution({ userId, projectId });

      return res.status(200).json({
        success: true,
        data: distribution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/creation-trend
   * Lịch sử tạo issue theo ngày trong tháng hiện tại
   */
  static async getCreationTrend(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      const trend = await DashboardService.getCreationTrend({ userId, projectId });

      return res.status(200).json({
        success: true,
        data: trend,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
