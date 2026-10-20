const ExportService = require('../services/export.service');
const ExportFlowService = require('../services/export-flow.service');
const ProjectModel = require('../models/project.model');

class ExportController {
  /**
   * Xuất tài liệu phân cấp yêu cầu phần mềm dưới dạng PDF hoặc Markdown
   * Điều phối qua n8n Flow 12 (12 MAIN Node) hoặc trực tiếp khi fallback
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
      const options = req.body?.options || {};

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

      // 4. Nếu là source draft nhưng không có dữ liệu draft
      if (source === 'draft' && (!draftData || (Array.isArray(draftData) && draftData.length === 0))) {
        const err = new Error('Không tìm thấy dữ liệu bản nháp AI để xuất. Vui lòng cung cấp danh sách bản nháp (draftData).');
        err.statusCode = 400;
        throw err;
      }

      // 5. Điều phối xuất file qua n8n Flow 12
      const result = await ExportFlowService.exportViaFlow12({
        userId,
        projectId,
        format,
        source,
        draftData,
        options,
      });

      const { stored, fileName, contentType } = result;

      // 6. Trả response nhị phân stream hoặc chuỗi văn bản về client
      if (stored.buffer) {
        res.setHeader('Content-Type', contentType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', stored.buffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).end(stored.buffer);
      } else {
        res.setHeader('Content-Type', contentType || 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).send(stored.content);
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExportController;
