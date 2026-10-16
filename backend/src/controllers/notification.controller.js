const EmailService = require('../services/email.service');

const NOTIFICATION_WEBHOOK_SECRET =
  process.env.NOTIFICATION_WEBHOOK_SECRET ||
  'ai_jira_agent_notification_secret_key_2026';

class NotificationController {
  /**
   * Endpoint nhận yêu cầu chuyển tiếp email từ n8n (Flow 11)
   * POST /api/notifications/dispatch-email
   * Yêu cầu xác thực bảo mật qua Header X-Webhook-Secret
   */
  static async dispatchEmail(req, res) {
    try {
      const receivedSecret =
        req.headers['x-webhook-secret'] || req.headers['X-Webhook-Secret'];

      if (!receivedSecret || receivedSecret !== NOTIFICATION_WEBHOOK_SECRET) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          error: 'Unauthorized: X-Webhook-Secret không hợp lệ.',
        });
      }

      const { to, subject, html, text, eventId } = req.body;

      if (!to || !subject) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'Thiếu thông tin người nhận (to) hoặc tiêu đề (subject).',
        });
      }

      console.log(`[NotificationController] Nhận yêu cầu dispatch email cho event [${eventId || 'n/a'}] tới: ${to}`);

      const result = await EmailService.sendEmail({ to, subject, html, text });

      if (!result.success) {
        return res.status(result.statusCode || 502).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('[NotificationController] Lỗi không xử lý được khi dispatch email:', error);
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: `Server Error: ${error.message}`,
      });
    }
  }
}

module.exports = NotificationController;
