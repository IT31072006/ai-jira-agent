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
};

export default dashboardApi;
