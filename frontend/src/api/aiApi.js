import apiClient from './apiClient';

export const analyzeRequirement = async (requirement) => {
  const response = await apiClient.post(
    '/ai/analyze',
    { requirement },
    { timeout: 120000 } // 2 phút cho các yêu cầu AI phân tích phức tạp
  );

  return response.data;
};