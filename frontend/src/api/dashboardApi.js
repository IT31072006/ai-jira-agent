import apiClient from './apiClient';

export const dashboardApi = {
  /**
   * Lấy số liệu tổng quan hệ thống (Total Projects, Epics, Stories, Tasks, Completion Rate)
   * @param {string} [projectId] - Tùy chọn: lọc theo dự án cụ thể
   */
  getSummary: async (projectId) => {
    const params = projectId ? { projectId } : {};
    const response = await apiClient.get('/dashboard/summary', { params });
    return response.data;
  },

  /**
   * Lấy thống kê phân loại số lượng Epic, Story, Task theo tháng và toàn thời gian
   * @param {string} [projectId] - Tùy chọn: lọc theo dự án cụ thể
   */
  getIssueBreakdown: async (projectId) => {
    const params = projectId ? { projectId } : {};
    const response = await apiClient.get('/dashboard/issue-breakdown', { params });
    return response.data;
  },

  /**
   * Lấy phân bố trạng thái To Do, In Progress, Done và tỷ lệ hoàn thành
   * @param {string} [projectId] - Tùy chọn: lọc theo dự án cụ thể
   */
  getStatusDistribution: async (projectId) => {
    const params = projectId ? { projectId } : {};
    const response = await apiClient.get('/dashboard/status-distribution', { params });
    return response.data;
  },

  /**
   * Lấy lịch sử tạo issue theo ngày trong tháng hiện tại
   * @param {string} [projectId] - Tùy chọn: lọc theo dự án cụ thể
   */
  getCreationTrend: async (projectId) => {
    const params = projectId ? { projectId } : {};
    const response = await apiClient.get('/dashboard/creation-trend', { params });
    return response.data;
  },

  /**
   * Lấy lịch sử snapshot thống kê tự động hằng ngày (7 ngày, 30 ngày)
   * @param {Object} options
   * @param {string} [options.projectId] - ID dự án (tùy chọn)
   * @param {number} [options.days=30] - Số ngày lịch sử (7 hoặc 30)
   */
  getSnapshots: async ({ projectId, days = 30 } = {}) => {
    const params = { limit: days };
    if (projectId) params.projectId = projectId;
    const response = await apiClient.get('/dashboard/snapshots', { params });
    return response.data;
  },

  /**
   * Lấy snapshot mới nhất kèm phân tích biến động tiến độ so với ngày trước
   * @param {string} [projectId] - ID dự án (tùy chọn)
   */
  getLatestSnapshot: async (projectId) => {
    const params = projectId ? { projectId } : {};
    const response = await apiClient.get('/dashboard/snapshots/latest', { params });
    return response.data;
  },

  /**
   * Kích hoạt chạy thống kê snapshot tự động theo yêu cầu (Chạy thử thủ công)
   * @param {string} [projectId] - ID dự án (tùy chọn)
   */
  triggerDailyAnalytics: async (projectId) => {
    const response = await apiClient.post('/dashboard/daily-analytics/trigger', { projectId });
    return response.data;
  },
};

export default dashboardApi;
