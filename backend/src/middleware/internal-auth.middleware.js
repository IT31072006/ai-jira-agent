const env = require('../config/env');

/**
 * Middleware bảo mật xác thực Service-to-Service giữa n8n Flow 10 và ExpressJS Backend
 * Đảm bảo các API nội bộ /api/internal/dashboard/* chỉ được gọi bởi n8n hoặc tiến trình hệ thống được ủy quyền.
 */
function internalAuthMiddleware(req, res, next) {
  const secretKey =
    req.headers['x-internal-service-key'] ||
    req.headers['x-webhook-secret'] ||
    req.query.internalSecret;

  const validSecrets = [
    env.INTERNAL_SERVICE_KEY,
    env.N8N_WEBHOOK_SECRET,
    process.env.NOTIFICATION_WEBHOOK_SECRET || 'ai_jira_agent_notification_secret_key_2026',
    'ai_jira_agent_internal_secret_2026',
  ].filter(Boolean);

  if (!secretKey || !validSecrets.includes(secretKey)) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Từ chối truy cập API nội bộ: X-Internal-Service-Key hoặc X-Webhook-Secret không hợp lệ hoặc bị thiếu.',
    });
  }

  next();
}

module.exports = internalAuthMiddleware;
