const express = require('express');

const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');
const configRoutes = require('./config.routes');
const aiRoutes = require('./ai.routes');
const jiraRoutes = require('./jira.routes');
const dashboardRoutes = require('./dashboard.routes');
const JiraController = require('../controllers/jira.controller');

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

// Alias cho webhook đồng bộ Jira theo chuẩn spec tài liệu
router.post('/webhooks/jira-sync', JiraController.handleWebhook);

module.exports = router;
