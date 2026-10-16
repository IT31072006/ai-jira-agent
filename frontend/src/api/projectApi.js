import apiClient from './apiClient';

export const projectApi = {
  getProjects: async () => {
    const response = await apiClient.get('/projects');
    return response.data;
  },

  getProjectById: async (id) => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  createProject: async ({ name, description, projectKey }) => {
    const response = await apiClient.post('/projects', {
      name,
      description,
      projectKey,
    });
    return response.data;
  },

  updateProject: async (id, { name, description, projectKey }) => {
    const response = await apiClient.put(`/projects/${id}`, {
      name,
      description,
      projectKey,
    });
    return response.data;
  },

  deleteProject: async (id) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },
};

export default projectApi;
