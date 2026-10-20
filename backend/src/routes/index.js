const express = require('express');

const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');
const configRoutes = require('./config.routes');
const aiRoutes = require('./ai.routes');
const jiraRoutes = require('./jira.routes');
const dashboardRoutes = require('./dashboard.routes');
const JiraController = require('../controllers/jira.controller');
const NotificationController = require('../controllers/notification.controller');
const internalDashboardRoutes = require('./internal-dashboard.routes');

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Backend Express đã sẵn sàng nhận dữ liệu!' });
});

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/config', configRoutes);
router.use('/ai', aiRoutes);
router.use('/jira', jiraRoutes);
router.use('/dashboard', dashboardRoutes);

// Internal routes: n8n Workflow 10 Fetch & Verify APIs
router.use('/internal/dashboard', internalDashboardRoutes);

// Alias cho webhook đồng bộ Jira theo chuẩn spec tài liệu
router.post('/webhooks/jira-sync', JiraController.handleWebhook);

// Internal route: n8n Workflow 11 dispatch email qua SMTP
router.post('/notifications/dispatch-email', NotificationController.dispatchEmail);

module.exports = router;

