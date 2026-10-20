const express = require('express');
const InternalExportController = require('../controllers/internal-export.controller');
const internalAuthMiddleware = require('../middleware/internal-auth.middleware');

const router = express.Router();

// Tải file export đã tạo (cho phép truy cập trực tiếp bằng exportId)
router.get('/download/:exportId', InternalExportController.downloadExport);

// Tất cả các internal API phục vụ orchestration n8n Flow 12 đều bắt buộc xác thực bảo mật
router.use(internalAuthMiddleware);

// MAIN 03: Xác minh quyền của người dùng đối với dự án
router.post('/verify-permission', InternalExportController.verifyPermission);

// MAIN 04: Trích xuất cấu trúc phân cấp (Jira Issues hoặc AI Draft)
router.post('/fetch-data', InternalExportController.fetchData);

// MAIN 08: Backend sinh file PDF thực tế bằng PDFKit & DejaVuSans
router.post('/generate-pdf', InternalExportController.generatePdf);

// MAIN 10: Backend sinh chuỗi Markdown hoàn chỉnh
router.post('/generate-markdown', InternalExportController.generateMarkdown);

module.exports = router;
