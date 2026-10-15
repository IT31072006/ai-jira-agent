const ExportService = require('../services/export.service');
const ProjectModel = require('../models/project.model');

class ExportController {
  /**
   * Xuất tài liệu phân cấp yêu cầu phần mềm dưới dạng PDF hoặc Markdown
   * Hỗ trợ GET /api/projects/:projectId/export?format=pdf|markdown&source=jira|draft
   * và POST /api/projects/:projectId/export (truyền draftData trong body khi xuất bản nháp)
   */
  static async exportDocumentation(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.params;

      // Hỗ trợ cả Query Params (GET) và Request Body (POST)
      const format = (req.query.format || req.body?.format || 'pdf').toLowerCase().trim();
      const source = (req.query.source || req.body?.source || 'jira').toLowerCase().trim();
      const draftData = req.body?.draftData || null;

      // 1. Kiểm tra format hợp lệ
      if (format !== 'pdf' && format !== 'markdown' && format !== 'md') {
        const err = new Error('Định dạng export không hợp lệ. Hệ thống chỉ hỗ trợ format="pdf" hoặc format="markdown".');
        err.statusCode = 400;
        throw err;
      }

      // 2. Kiểm tra source hợp lệ
      if (source !== 'jira' && source !== 'draft') {
        const err = new Error('Nguồn dữ liệu không hợp lệ. Hệ thống chỉ hỗ trợ source="jira" (issue đã tạo) hoặc source="draft" (bản nháp AI).');
        err.statusCode = 400;
        throw err;
      }

      // 3. Phân quyền: Kiểm tra người dùng có quyền truy cập vào project này không
      const project = await ProjectModel.findByIdAndUserId(projectId, userId);
      if (!project) {
        const err = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập vào dự án này.');
        err.statusCode = 404;
        throw err;
      }

      // 4. Lấy và chuẩn hóa mô hình dữ liệu đồng nhất
      let model;
      if (source === 'draft') {
        if (!draftData || (Array.isArray(draftData) && draftData.length === 0)) {
          const err = new Error('Không tìm thấy dữ liệu bản nháp AI để xuất. Vui lòng cung cấp danh sách bản nháp (draftData).');
          err.statusCode = 400;
          throw err;
        }
        model = ExportService.normalizeHierarchyFromDraft({ draftData, project });
      } else {
        // source === 'jira' (lấy từ PostgreSQL bảng jira_issues)
        model = await ExportService.getHierarchyFromJira({ projectId, userId, project });
      }

      // 5. Sinh tên file an toàn: AI-Jira-Agent-[KEY]-[YYYY-MM-DD].[pdf|md]
      const finalFormat = (format === 'md' || format === 'markdown') ? 'md' : 'pdf';
      const fileName = ExportService.generateFileName(project.project_key, finalFormat);

      // 6. Xử lý xuất file theo định dạng
      if (finalFormat === 'md') {
        const markdownContent = ExportService.generateMarkdown(model);

        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).send(markdownContent);
      } else {
        const pdfBuffer = await ExportService.generatePdf(model);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).end(pdfBuffer);
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExportController;
