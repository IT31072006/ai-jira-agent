const express = require('express');
const InternalDashboardController = require('../controllers/internal-dashboard.controller');
const internalAuthMiddleware = require('../middleware/internal-auth.middleware');

const router = express.Router();

// Tất cả các internal routes phục vụ Flow 10 đều phải qua internalAuthMiddleware
router.use(internalAuthMiddleware);

// MAIN 03: Xác minh quyền truy cập dự án
router.post('/verify-access', InternalDashboardController.verifyAccess);
router.get('/verify-access', InternalDashboardController.verifyAccess);

// MAIN 04: Lấy thống kê tổng quan
router.get('/summary', InternalDashboardController.getSummary);

// MAIN 05: Lấy phân bố trạng thái
router.get('/status-distribution', InternalDashboardController.getStatusDistribution);

// MAIN 06: Lấy phân loại số lượng issue
router.get('/issue-breakdown', InternalDashboardController.getIssueBreakdown);

// MAIN 07: Lấy xu hướng tạo issue
router.get('/creation-trend', InternalDashboardController.getCreationTrend);

module.exports = router;
