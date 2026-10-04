import apiClient from './apiClient';

export const configApi = {
  getConfig: async () => {
    const response = await apiClient.get('/config');
    return response.data;
  },

  updateConfig: async (data) => {
    const response = await apiClient.put('/config', data);
    return response.data;
  },

  deleteConfig: async (type = null) => {
    const url = type ? `/config?type=${type}` : '/config';
    const response = await apiClient.delete(url);
    return response.data;
  },
};

export default configApi;
