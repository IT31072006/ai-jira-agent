const DashboardFlowService = require('../services/dashboard-flow.service');
const DashboardService = require('../services/dashboard.service');
const DailyAnalyticsService = require('../services/daily-analytics.service');
const ProjectModel = require('../models/project.model');

class DashboardController {
  /**
   * GET /api/dashboard/summary
   * Tổng quan số liệu thống kê Dashboard thông qua Flow 10
   */
  static async getSummary(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      const summary = await DashboardFlowService.getSummary({ userId, projectId });

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

      const breakdown = await DashboardFlowService.getIssueBreakdown({ userId, projectId });

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

      const distribution = await DashboardFlowService.getStatusDistribution({ userId, projectId });

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

      const trend = await DashboardFlowService.getCreationTrend({ userId, projectId });

      return res.status(200).json({
        success: true,
        data: trend,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/analytics
   * Lấy toàn bộ số liệu Dashboard tổng hợp từ n8n Flow 10 trong 1 lượt gọi
   */
  static async getAnalytics(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      const analytics = await DashboardFlowService.getAllAnalytics({ userId, projectId });

      return res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/snapshots
   * Lấy lịch sử snapshots thống kê hằng ngày của một dự án (phục vụ biểu đồ tiến độ)
   */
  static async getSnapshots(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId, limit = 30, startDate, endDate } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng cung cấp projectId để xem lịch sử snapshot.',
        });
      }

      // Xác minh quyền sở hữu dự án
      const project = await ProjectModel.findByIdAndUserId(projectId, userId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Dự án không tồn tại hoặc bạn không có quyền truy cập.',
        });
      }

      const snapshots = await DailyAnalyticsService.getProjectSnapshots(projectId, {
        limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 30)),
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            projectKey: project.project_key,
          },
          snapshots,
          total: snapshots.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/snapshots/latest
   * Lấy snapshot mới nhất kèm phân tích biến động tiến độ so với ngày trước
   */
  static async getLatestSnapshot(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng cung cấp projectId.',
        });
      }

      const project = await ProjectModel.findByIdAndUserId(projectId, userId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Dự án không tồn tại hoặc bạn không có quyền truy cập.',
        });
      }

      const snapshot = await DailyAnalyticsService.getLatestSnapshotWithFluctuation(projectId);

      return res.status(200).json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            projectKey: project.project_key,
          },
          snapshot,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/dashboard/daily-analytics/trigger
   * Cho phép người dùng chạy thử thống kê tự động cho dự án của mình theo yêu cầu
   */
  static async triggerDailyAnalytics(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.body || {};

      let projectsToRun = [];
      if (projectId) {
        const project = await ProjectModel.findByIdAndUserId(projectId, userId);
        if (!project) {
          return res.status(404).json({
            success: false,
            error: 'Dự án không tồn tại hoặc bạn không có quyền truy cập.',
          });
        }
        projectsToRun = [project];
      } else {
        projectsToRun = await ProjectModel.findByUserId(userId);
      }

      const snapshotDate = DailyAnalyticsService.getVietnamDate();
      const jobId = `job-manual-${Date.now()}`;
      const results = [];

      for (const p of projectsToRun) {
        try {
          const resProj = await DailyAnalyticsService.processProjectDailyAnalytics(p, {
            snapshotDate,
            jobId,
            forceRefresh: true,
          });
          results.push(resProj);
        } catch (err) {
          results.push({
            projectId: p.id,
            projectName: p.name,
            success: false,
            error: err.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Đã thực thi phân tích thống kê cho ${projectsToRun.length} dự án.`,
        data: {
          jobId,
          snapshotDate,
          totalProjects: projectsToRun.length,
          results,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
