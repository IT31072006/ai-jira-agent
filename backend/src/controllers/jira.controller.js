const JiraService = require('../services/jira.service');
const ProjectModel = require('../models/project.model');

class JiraController {
  /**
   * Endpoint nhận yêu cầu đẩy dữ liệu lên Jira từ Frontend
   * POST /api/jira/push
   */
  static async push(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectKey, epics, projectId } = req.body;

      if (projectId && typeof projectId === 'string' && projectId.trim()) {
        const project = await ProjectModel.findByIdAndUserId(projectId.trim(), userId);
        if (!project) {
          const err = new Error('Dự án / Workspace không tồn tại hoặc bạn không có quyền truy cập.');
          err.statusCode = 404;
          throw err;
        }
      }

      const result = await JiraService.pushToJira({
        userId,
        projectKey,
        epics,
        projectId,
      });

      return res.status(200).json({
        success: true,
        message: 'Đẩy dữ liệu lên Jira thành công qua n8n!',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint lấy danh sách thành viên trong dự án Jira (Luồng 8)
   * GET /api/jira/members?projectKey=KEY
   */
  static async getMembers(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectKey } = req.query;

      const members = await JiraService.getProjectMembers({
        userId,
        projectKey,
      });

      return res.status(200).json({
        success: true,
        count: members.length,
        members,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint lấy danh sách dự án Jira từ Jira Cloud
   * GET /api/jira/projects
   */
  static async getProjects(req, res, next) {
    try {
      const userId = req.user.id;
      const projects = await JiraService.getJiraProjects(userId);
      return res.status(200).json({
        success: true,
        count: projects.length,
        projects,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint lắng nghe Webhook từ Atlassian Jira Cloud (Luồng 9: Đồng bộ trạng thái ngược)
   * POST /api/jira/webhook-sync (hoặc POST /api/webhooks/jira-sync)
   * Lưu ý: Không yêu cầu Bearer token của user vì Jira Cloud gọi trực tiếp
   */
  static async handleWebhook(req, res, next) {
    try {
      // 1. Kiểm tra chữ ký HMAC nếu có cấu hình JIRA_WEBHOOK_SECRET
      const sigCheck = JiraService.verifyWebhookSignature(req);
      if (!sigCheck.valid) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: sigCheck.reason,
        });
      }

      // 2. Kiểm tra tính hợp lệ của Payload
      const payload = req.body;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Payload webhook không hợp lệ (yêu cầu JSON object).',
        });
      }

      const result = await JiraService.handleJiraWebhook(payload);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint lấy danh sách các Jira issue đã đồng bộ vào database
   * GET /api/jira/synced-issues?projectKey=KEY
   */
  static async getSyncedIssues(req, res, next) {
    try {
      const userId = req.user?.id;
      const { projectKey, projectId } = req.query;

      // 1. Kiểm tra tính hợp lệ và quyền sở hữu Workspace nếu có projectId
      if (projectId && typeof projectId === 'string' && projectId.trim()) {
        const cleanProjectId = projectId.trim();
        const project = await ProjectModel.findByIdAndUserId(cleanProjectId, userId);
        if (!project) {
          const err = new Error('Dự án / Workspace không tồn tại hoặc bạn không có quyền truy cập.');
          err.statusCode = 404;
          throw err;
        }
      }

      // Tự động đối soát và kéo trạng thái mới nhất từ Jira Cloud REST API nếu có cờ sync=true
      if ((req.query.sync === 'true' || req.query.reconcile === 'true') && userId) {
        await JiraService.syncIssuesFromJiraCloud({ userId, projectId, projectKey });
      }

      const issues = await JiraService.getSyncedIssues({ projectKey, projectId, userId });

      const publicBaseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL
        ? process.env.PUBLIC_WEBHOOK_BASE_URL.trim().replace(/\/+$/, '')
        : '';
      const publicWebhookUrl = publicBaseUrl
        ? `${publicBaseUrl}/api/jira/webhook-sync`
        : '';

      return res.status(200).json({
        success: true,
        count: issues.length,
        issues,
        publicWebhookBaseUrl: publicBaseUrl || null,
        publicWebhookUrl: publicWebhookUrl || null,
        isWebhookSecretConfigured: Boolean(
          process.env.JIRA_WEBHOOK_SECRET && process.env.JIRA_WEBHOOK_SECRET.trim()
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint giả lập gửi Webhook từ Jira (dành cho demo và kiểm thử nhanh)
   * POST /api/jira/test-webhook-sync
   */
  static async simulateWebhook(req, res, next) {
    try {
      const { issueKey, status, assignee, summary, issueType, projectKey } = req.body;

      const result = await JiraService.simulateWebhookSync({
        issueKey,
        status,
        assignee,
        summary,
        issueType,
        projectKey,
      });

      return res.status(200).json({
        success: true,
        message: `Đã giả lập thành công sự kiện Jira Webhook cho issue ${issueKey}!`,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = JiraController;
