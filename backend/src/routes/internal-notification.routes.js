const express = require('express');
const InternalNotificationController = require('../controllers/internal-notification.controller');
const internalAuthMiddleware = require('../middleware/internal-auth.middleware');

const router = express.Router();

// Tất cả internal routes cho Flow 11 đều phải qua internalAuthMiddleware
router.use(internalAuthMiddleware);

// MAIN 04: Xác minh sự kiện thông báo với Backend
router.post('/verify-event', InternalNotificationController.verifyEvent);

// MAIN 05: Lấy cấu hình thông báo an toàn từ Backend
router.get('/config', InternalNotificationController.getConfig);
router.post('/config', InternalNotificationController.getConfig);

// MAIN 07: Atomic Claim Idempotency trên CSDL Backend
router.post('/claim-idempotency', InternalNotificationController.claimIdempotency);

// MAIN 10: Thực hiện gửi thông báo thực tế (Gmail SMTP, Discord, Slack) qua Backend
router.post('/dispatch', InternalNotificationController.dispatch);

// MAIN 11: Lưu kết quả cuối cùng của sự kiện thông báo vào CSDL
router.post('/finalize', InternalNotificationController.finalize);

module.exports = router;
