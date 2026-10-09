const JiraService = require('../services/jira.service');

class JiraController {
  /**
   * Endpoint nhận yêu cầu đẩy dữ liệu lên Jira từ Frontend
   * POST /api/jira/push
   */
  static async push(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectKey, epics } = req.body;

      const result = await JiraService.pushToJira({
        userId,
        projectKey,
        epics,
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
      const payload = req.body;
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
      const { projectKey } = req.query;
      const issues = await JiraService.getSyncedIssues(projectKey);

      return res.status(200).json({
        success: true,
        count: issues.length,
        issues,
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
