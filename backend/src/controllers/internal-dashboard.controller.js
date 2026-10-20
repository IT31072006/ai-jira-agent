const DashboardService = require('../services/dashboard.service');
const ProjectModel = require('../models/project.model');

class InternalDashboardController {
  /**
   * POST /api/internal/dashboard/verify-access
   * MAIN 03: Xác minh quyền truy cập dự án và ngữ cảnh người dùng
   */
  static async verifyAccess(req, res) {
    try {
      const userId = req.body?.userId || req.query?.userId;
      const projectId = req.body?.projectId || req.query?.projectId || null;

      if (!userId) {
        return res.status(400).json({
          success: false,
          allowed: false,
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Yêu cầu thiếu userId của phiên người dùng.',
        });
      }

      let project = null;
      if (projectId) {
        project = await ProjectModel.findByIdAndUserId(projectId, userId);
        if (!project) {
          return res.status(403).json({
            success: false,
            allowed: false,
            statusCode: 403,
            error: 'ACCESS_DENIED',
            message: 'Dự án không tồn tại hoặc người dùng không có quyền truy cập.',
          });
        }
      }

      return res.status(200).json({
        success: true,
        allowed: true,
        data: {
          allowed: true,
          userId,
          projectId: project ? project.id : null,
          project: project
            ? {
                id: project.id,
                name: project.name,
                projectKey: project.project_key || ProjectModel.generateDefaultKey(project.name),
              }
            : null,
          verifiedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[InternalDashboardController] verifyAccess error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        allowed: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/internal/dashboard/summary
   * MAIN 04: Lấy thống kê tổng quan (Total Issues, Epics, Stories, Tasks, Points)
   */
  static async getSummary(req, res) {
    try {
      const userId = req.query.userId || req.body?.userId;
      const projectId = req.query.projectId || req.body?.projectId || null;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu userId',
        });
      }

      const summary = await DashboardService.getSummary({ userId, projectId });
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('[InternalDashboardController] getSummary error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/internal/dashboard/status-distribution
   * MAIN 05: Lấy phân bố trạng thái (To Do, In Progress, Done)
   */
  static async getStatusDistribution(req, res) {
    try {
      const userId = req.query.userId || req.body?.userId;
      const projectId = req.query.projectId || req.body?.projectId || null;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu userId',
        });
      }

      const distribution = await DashboardService.getStatusDistribution({ userId, projectId });
      return res.status(200).json({
        success: true,
        data: distribution,
      });
    } catch (error) {
      console.error('[InternalDashboardController] getStatusDistribution error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/internal/dashboard/issue-breakdown
   * MAIN 06: Lấy phân loại số lượng theo loại issue (Epic, Story, Task)
   */
  static async getIssueBreakdown(req, res) {
    try {
      const userId = req.query.userId || req.body?.userId;
      const projectId = req.query.projectId || req.body?.projectId || null;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu userId',
        });
      }

      const breakdown = await DashboardService.getIssueBreakdown({ userId, projectId });
      return res.status(200).json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      console.error('[InternalDashboardController] getIssueBreakdown error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/internal/dashboard/creation-trend
   * MAIN 07: Lấy dữ liệu xu hướng tạo issue theo ngày trong tháng
   */
  static async getCreationTrend(req, res) {
    try {
      const userId = req.query.userId || req.body?.userId;
      const projectId = req.query.projectId || req.body?.projectId || null;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu userId',
        });
      }

      const trend = await DashboardService.getCreationTrend({ userId, projectId });
      return res.status(200).json({
        success: true,
        data: trend,
      });
    } catch (error) {
      console.error('[InternalDashboardController] getCreationTrend error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = InternalDashboardController;
