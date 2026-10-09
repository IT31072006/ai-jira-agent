import apiClient from './apiClient';

/**
 * Trích xuất tên file từ header Content-Disposition hoặc tạo tên mặc định
 */
function extractFileName(contentDisposition, defaultName) {
  if (contentDisposition) {
    const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return defaultName;
}

/**
 * Tải file blob về máy người dùng
 */
export function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const exportApi = {
  /**
   * Gọi API xuất tài liệu yêu cầu (PDF hoặc Markdown)
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.format - 'pdf' | 'markdown'
   * @param {string} params.source - 'jira' | 'draft'
   * @param {Array|Object} [params.draftData] - Danh sách bản nháp AI nếu source === 'draft'
   */
  exportProject: async ({ projectId, format = 'pdf', source = 'jira', draftData = null }) => {
    const ext = format === 'markdown' ? 'md' : 'pdf';
    const fallbackFileName = `AI-Jira-Agent-Export.${ext}`;

    let response;
    if (source === 'draft') {
      response = await apiClient.post(
        `/projects/${projectId}/export`,
        { format, source, draftData },
        { responseType: 'blob' }
      );
    } else {
      response = await apiClient.get(
        `/projects/${projectId}/export?format=${format}&source=${source}`,
        { responseType: 'blob' }
      );
    }

    const disposition = response.headers['content-disposition'];
    const fileName = extractFileName(disposition, fallbackFileName);

    return {
      blob: response.data,
      fileName,
    };
  },
};

export default exportApi;
