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

  const validSecret = env.INTERNAL_SERVICE_KEY || env.N8N_WEBHOOK_SECRET || 'ai_jira_agent_internal_secret_2026';

  if (!secretKey || secretKey !== validSecret) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Từ chối truy cập API nội bộ: X-Internal-Service-Key không hợp lệ hoặc bị thiếu.',
    });
  }

  next();
}

module.exports = internalAuthMiddleware;
