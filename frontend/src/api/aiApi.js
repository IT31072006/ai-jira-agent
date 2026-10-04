import apiClient from './apiClient';

export const analyzeRequirement = async (requirement) => {
  const response = await apiClient.post('/ai/analyze', {
    requirement,
  });

  return response.data;
};