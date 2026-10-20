const axios = require('axios');
const env = require('../config/env');
const ExportService = require('./export.service');
const InternalExportController = require('../controllers/internal-export.controller');
const ProjectModel = require('../models/project.model');

/**
 * Gửi HTTP POST tới webhook n8n với cơ chế tự động thử lại fallback /webhook/ <-> /webhook-test/
 */
async function postToN8n(primaryUrl, payload, headers, timeout = 10000) {
  try {
    return await axios.post(primaryUrl, payload, { headers, timeout });
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (primaryUrl.includes('/webhook/')) {
        fallbackUrl = primaryUrl.replace('/webhook/', '/webhook-test/');
      } else if (primaryUrl.includes('/webhook-test/')) {
        fallbackUrl = primaryUrl.replace('/webhook-test/', '/webhook/');
      }

      if (fallbackUrl) {
        console.log(`[ExportFlowService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, { headers, timeout });
      }
    }
    throw err;
  }
}

class ExportFlowService {
  /**
   * Điều phối xuất tài liệu qua n8n Flow 12 (12 MAIN Node Orchestration)
   * @param {Object} params
   * @param {string} params.userId - ID người dùng đã xác thực JWT
   * @param {string|number} params.projectId - ID dự án
   * @param {string} [params.format='pdf'] - Định dạng: 'pdf' hoặc 'markdown'
   * @param {string} [params.source='jira'] - Nguồn dữ liệu: 'jira' hoặc 'draft'
   * @param {Array} [params.draftData=null] - Danh sách bản nháp AI (nếu source = 'draft')
   * @param {Object} [params.options={}] - Tùy chọn xuất bổ sung
   */
  static async exportViaFlow12({
    userId,
    projectId,
    format = 'pdf',
    source = 'jira',
    draftData = null,
    options = {},
  }) {
    const normFormat = (format === 'md' || format === 'markdown') ? 'markdown' : 'pdf';
    const normSource = source === 'draft' ? 'draft' : 'jira';

    const webhookUrl = env.N8N_EXPORT_WEBHOOK_URL;
    const backendUrl = process.env.BACKEND_INTERNAL_URL || `http://localhost:${env.PORT || 5000}`;
    const internalSecret = env.INTERNAL_SERVICE_KEY;

    const payload = {
      userId,
      projectId,
      format: normFormat,
      source: normSource,
      draftData,
      options,
      requestId: `req-exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      backendUrl,
      internalSecret,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const response = await postToN8n(webhookUrl, payload, headers, 10000);
      const result = response.data;

      if (result && result.success && result.exportId) {
        const stored = InternalExportController.getStoredExport(result.exportId);
        if (stored) {
          return {
            stored,
            executionSource: 'n8n-flow-12',
            fileName: result.fileName || stored.fileName,
            contentType: result.contentType || stored.contentType,
            format: result.format || stored.format,
            exportId: result.exportId,
          };
        }
      }

      if (result && result.success === false) {
        const error = new Error(result.message || 'Yêu cầu xuất tài liệu không thành công.');
        error.statusCode = result.statusCode || 400;
        error.code = result.error;
        throw error;
      }

      // Nếu n8n trả về kết quả hợp lệ nhưng cache cục bộ không tìm thấy exportId
      // (ví dụ multi-worker), fallback sang sinh file trực tiếp
      console.warn('[ExportFlowService] Không tìm thấy exportId trong store. Chuyển sang Direct Fallback.');
    } catch (err) {
      // Nếu n8n trả về lỗi nghiệp vụ (ví dụ 400, 403, 404, 422), forward trực tiếp lỗi cho client
      if (err.response && err.response.data && err.response.data.success === false) {
        const error = new Error(err.response.data.message || 'Lỗi xuất tài liệu từ workflow.');
        error.statusCode = err.response.status || err.response.data.statusCode || 400;
        error.code = err.response.data.error;
        throw error;
      }

      if (err.statusCode) {
        throw err;
      }

      console.warn(
        `[ExportFlowService] n8n Flow 12 không phản hồi (${err.message}). Kích hoạt Direct Backend Fallback.`
      );
    }

    // Direct Backend Fallback Engine: Đảm bảo 100% độ sẵn sàng
    return await this.exportDirectFallback({
      userId,
      projectId,
      format: normFormat,
      source: normSource,
      draftData,
    });
  }

  /**
   * Động cơ sinh file dự phòng trực tiếp tại Backend
   */
  static async exportDirectFallback({ userId, projectId, format, source, draftData }) {
    const project = await ProjectModel.findByIdAndUserId(projectId, userId);
    if (!project) {
      const err = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập vào dự án này.');
      err.statusCode = 404;
      throw err;
    }

    let model;
    if (source === 'draft') {
      if (!draftData || (Array.isArray(draftData) && draftData.length === 0)) {
        const err = new Error('Không tìm thấy dữ liệu bản nháp AI để xuất.');
        err.statusCode = 400;
        throw err;
      }
      model = ExportService.normalizeHierarchyFromDraft({ draftData, project });
    } else {
      model = await ExportService.getHierarchyFromJira({ projectId, userId, project });
    }

    const isMd = (format === 'md' || format === 'markdown');
    const finalFormat = isMd ? 'md' : 'pdf';
    const fileName = ExportService.generateFileName(project.project_key, finalFormat);

    if (isMd) {
      const markdownContent = ExportService.generateMarkdown(model);
      return {
        stored: {
          content: markdownContent,
          fileName,
          contentType: 'text/markdown; charset=utf-8',
          format: 'markdown',
        },
        executionSource: 'backend-direct-fallback',
        fileName,
        contentType: 'text/markdown; charset=utf-8',
        format: 'markdown',
      };
    } else {
      const pdfBuffer = await ExportService.generatePdf(model);
      return {
        stored: {
          buffer: pdfBuffer,
          fileName,
          contentType: 'application/pdf',
          format: 'pdf',
        },
        executionSource: 'backend-direct-fallback',
        fileName,
        contentType: 'application/pdf',
        format: 'pdf',
      };
    }
  }
}

module.exports = ExportFlowService;
