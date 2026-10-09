import apiClient from './apiClient';

export const jiraApi = {
  /**
   * Gọi backend Express để đẩy Epics -> Stories -> Tasks sang n8n và tạo trên Jira
   * @param {Object} data
   * @param {string} data.projectKey - Jira project key (vd: KAN, PROJ)
   * @param {Array} data.epics - Danh sách cấu trúc Epic -> Story -> Task
   * @returns {Promise<any>}
   */
  pushToJira: async ({ projectKey, epics }) => {
    const response = await apiClient.post('/jira/push', {
      projectKey,
      epics,
    });
    return response.data;
  },

  /**
   * Gọi backend Express để lấy danh sách thành viên/assignees của dự án từ Jira (Luồng 8)
   * @param {string} projectKey - Mã dự án Jira (vd: KAN, PROJ)
   * @returns {Promise<{success: boolean, count: number, members: Array}>}
   */
  getMembers: async (projectKey) => {
    const response = await apiClient.get('/jira/members', {
      params: { projectKey },
    });
    return response.data;
  },

  /**
   * Gọi backend Express để lấy danh sách các dự án trên Jira Cloud
   * @returns {Promise<{success: boolean, count: number, projects: Array}>}
   */
  getProjects: async () => {
    const response = await apiClient.get('/jira/projects');
    return response.data;
  },

  /**
   * Lấy danh sách các issue Jira đã đồng bộ từ database (Luồng 9: Webhook Sync)
   * @param {string} [projectKey] - Mã dự án Jira
   */
  getSyncedIssues: async (projectKey) => {
    const response = await apiClient.get('/jira/synced-issues', {
      params: { projectKey },
    });
    return response.data;
  },

  /**
   * Giả lập gửi sự kiện Webhook từ Jira để kiểm thử đồng bộ ngược (Luồng 9)
   * @param {Object} data
   */
  simulateWebhookSync: async ({ issueKey, status, assignee, summary, issueType, projectKey }) => {
    const response = await apiClient.post('/jira/test-webhook-sync', {
      issueKey,
      status,
      assignee,
      summary,
      issueType,
      projectKey,
    });
    return response.data;
  },
};

export default jiraApi;
