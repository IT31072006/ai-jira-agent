const ExportService = require('../services/export.service');
const ProjectModel = require('../models/project.model');

// Bộ lưu trữ tạm thời các file export tạo bởi n8n Flow 12 (TTL 10 phút)
const exportStore = new Map();
const EXPORT_TTL_MS = 10 * 60 * 1000;

function cleanupOldExports() {
  const now = Date.now();
  for (const [id, item] of exportStore.entries()) {
    if (now - item.createdAt > EXPORT_TTL_MS) {
      exportStore.delete(id);
    }
  }
}
setInterval(cleanupOldExports, 60000).unref();

class InternalExportController {
  /**
   * Lấy bản ghi file export đã lưu trong cache
   */
  static getStoredExport(exportId) {
    return exportStore.get(exportId);
  }

  /**
   * Xóa bản ghi file export khỏi cache
   */
  static clearCache() {
    exportStore.clear();
  }

  /**
   * POST /api/internal/export/verify-permission
   * MAIN 03: Xác minh quyền của người dùng đối với dự án trước khi xuất file
   */
  static async verifyPermission(req, res) {
    try {
      const { projectId, userId } = req.body;
      if (!projectId || !userId) {
        return res.status(400).json({
          success: false,
          allowed: false,
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Yêu cầu thiếu projectId hoặc userId.',
        });
      }

      const project = await ProjectModel.findByIdAndUserId(projectId, userId);
      if (!project) {
        return res.status(404).json({
          success: false,
          allowed: false,
          statusCode: 404,
          error: 'PROJECT_ACCESS_DENIED',
          message: 'Dự án không tồn tại hoặc bạn không có quyền truy cập vào dự án này.',
        });
      }

      return res.status(200).json({
        success: true,
        allowed: true,
        data: {
          allowed: true,
          userId,
          projectId,
          project: {
            id: project.id,
            name: project.name,
            projectKey: project.project_key,
            description: project.description,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/internal/export/fetch-data
   * MAIN 04: Trích xuất cấu trúc phân cấp (Jira Issues hoặc AI Draft)
   */
  static async fetchData(req, res) {
    try {
      const { projectId, userId, source = 'jira', draftData = null } = req.body;
      if (!projectId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Yêu cầu thiếu projectId hoặc userId.',
        });
      }

      const project = await ProjectModel.findByIdAndUserId(projectId, userId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'PROJECT_NOT_FOUND',
          message: 'Không tìm thấy thông tin dự án.',
        });
      }

      let model;
      if (source === 'draft') {
        if (!draftData || (Array.isArray(draftData) && draftData.length === 0)) {
          return res.status(400).json({
            success: false,
            error: 'EMPTY_DRAFT_DATA',
            message: 'Không tìm thấy dữ liệu bản nháp AI để xuất.',
          });
        }
        model = ExportService.normalizeHierarchyFromDraft({ draftData, project });
      } else {
        model = await ExportService.getHierarchyFromJira({ projectId, userId, project });
      }

      return res.status(200).json({
        success: true,
        data: {
          model,
          project: {
            id: project.id,
            name: project.name,
            projectKey: project.project_key,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/internal/export/generate-pdf
   * MAIN 08: Backend sinh file PDF thực tế bằng PDFKit & DejaVuSans
   */
  static async generatePdf(req, res) {
    try {
      const { model, pdfConfig } = req.body;
      if (!model) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Thiếu dữ liệu mô hình phân cấp (model) để tạo PDF.',
        });
      }

      const pdfBuffer = await ExportService.generatePdf(model);
      const exportId = `exp_pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fileName = ExportService.generateFileName(model.projectKey || 'PROJECT', 'pdf');

      exportStore.set(exportId, {
        buffer: pdfBuffer,
        fileName,
        contentType: 'application/pdf',
        format: 'pdf',
        createdAt: Date.now(),
      });

      return res.status(200).json({
        success: true,
        exportId,
        fileName,
        format: 'pdf',
        contentType: 'application/pdf',
        size: pdfBuffer.length,
        downloadUrl: `/api/internal/export/download/${exportId}`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/internal/export/generate-markdown
   * MAIN 10: Backend sinh chuỗi Markdown hoàn chỉnh
   */
  static async generateMarkdown(req, res) {
    try {
      const { model, markdownConfig } = req.body;
      if (!model) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Thiếu dữ liệu mô hình phân cấp (model) để tạo Markdown.',
        });
      }

      const markdownContent = ExportService.generateMarkdown(model);
      const exportId = `exp_md_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fileName = ExportService.generateFileName(model.projectKey || 'PROJECT', 'md');

      exportStore.set(exportId, {
        content: markdownContent,
        fileName,
        contentType: 'text/markdown; charset=utf-8',
        format: 'markdown',
        createdAt: Date.now(),
      });

      return res.status(200).json({
        success: true,
        exportId,
        fileName,
        format: 'markdown',
        contentType: 'text/markdown; charset=utf-8',
        size: Buffer.byteLength(markdownContent, 'utf8'),
        downloadUrl: `/api/internal/export/download/${exportId}`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/internal/export/download/:exportId
   * Tải file đã sinh từ n8n orchestration
   */
  static async downloadExport(req, res) {
    const { exportId } = req.params;
    const item = exportStore.get(exportId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'File xuất không tồn tại hoặc đã hết hạn.',
      });
    }

    res.setHeader('Content-Type', item.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${item.fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (item.buffer) {
      res.setHeader('Content-Length', item.buffer.length);
      return res.status(200).end(item.buffer);
    } else {
      return res.status(200).send(item.content);
    }
  }
}

module.exports = InternalExportController;
