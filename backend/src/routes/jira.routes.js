const express = require('express');
const JiraController = require('../controllers/jira.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Yêu cầu xác thực JWT để lấy cấu hình Jira của người dùng
router.post('/push', authMiddleware, JiraController.push);
router.get('/members', authMiddleware, JiraController.getMembers);

// Luồng 9: Webhook Sync từ Jira (Jira Cloud gọi trực tiếp, không dùng JWT auth)
router.post('/webhook-sync', JiraController.handleWebhook);

// Luồng 9: Lấy danh sách các issue Jira đã đồng bộ và giả lập sự kiện
router.get('/synced-issues', authMiddleware, JiraController.getSyncedIssues);
router.post('/test-webhook-sync', authMiddleware, JiraController.simulateWebhook);

module.exports = router;
