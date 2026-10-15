const express = require('express');
const ProjectController = require('../controllers/project.controller');
const authMiddleware = require('../middleware/auth.middleware');

const ExportController = require('../controllers/export.controller');

const router = express.Router();

// Tất cả các API quản lý project đều yêu cầu xác thực JWT từ Flow 1
router.use(authMiddleware);

router.get('/', ProjectController.getAll);
router.get('/:id', ProjectController.getById);
router.post('/', ProjectController.create);
router.put('/:id', ProjectController.update);
router.delete('/:id', ProjectController.delete);

// Luồng 12: Export Documentation (PDF & Markdown)
router.get('/:projectId/export', ExportController.exportDocumentation);
router.post('/:projectId/export', ExportController.exportDocumentation);

module.exports = router;
