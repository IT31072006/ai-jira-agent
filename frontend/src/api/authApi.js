import apiClient from './apiClient';

export const authApi = {
  register: async ({ name, email, password }) => {
    const response = await apiClient.post('/auth/register', {
      name,
      email,
      password,
    });
    return response.data;
  },

  login: async ({ email, password }) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot-password', {
      email,
    });
    return response.data;
  },

  verifyOtp: async ({ email, otpCode }) => {
    const response = await apiClient.post('/auth/verify-otp', {
      email,
      otpCode,
    });
    return response.data;
  },

  resetPassword: async ({ email, otpCode, newPassword }) => {
    const response = await apiClient.post('/auth/reset-password', {
      email,
      otpCode,
      newPassword,
    });
    return response.data;
  },
};

export default authApi;
