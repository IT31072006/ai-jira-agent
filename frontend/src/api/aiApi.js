import apiClient from './apiClient';

export const analyzeRequirement = async (requirement, projectId = null) => {
  const response = await apiClient.post(
    '/ai/analyze',
    { requirement, projectId },
    { timeout: 120000 } // 2 phút cho các yêu cầu AI phân tích phức tạp
  );

  return response.data;
};

export const mutateStoryTaskApi = async (payload) => {
  const response = await apiClient.post(
    '/ai/mutate-story-task',
    payload,
    { timeout: 15000 } // 15s cho các thao tác thêm sửa xóa Story/Task
  );

  return response.data;
};