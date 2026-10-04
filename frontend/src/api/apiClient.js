import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: tự động thêm Authorization: Bearer <token>
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: xử lý phản hồi và lỗi
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Nếu token hết hạn hoặc không hợp lệ (401), xử lý phù hợp
    if (error.response && error.response.status === 401) {
      // Có thể xóa token khi token không còn hợp lệ
      // tokenStorage.removeToken();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
