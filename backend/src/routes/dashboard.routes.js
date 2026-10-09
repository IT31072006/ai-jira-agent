const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Tất cả các endpoint của Dashboard & Reporting đều được bảo vệ bằng JWT xác thực
router.get('/summary', authMiddleware, DashboardController.getSummary);
router.get('/issue-breakdown', authMiddleware, DashboardController.getIssueBreakdown);
router.get('/status-distribution', authMiddleware, DashboardController.getStatusDistribution);
router.get('/creation-trend', authMiddleware, DashboardController.getCreationTrend);

module.exports = router;
