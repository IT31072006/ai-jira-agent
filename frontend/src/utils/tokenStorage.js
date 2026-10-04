const TOKEN_KEY = 'ai_jira_agent_token';

export const tokenStorage = {
  saveToken: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.error('Lỗi lưu token vào localStorage:', e);
    }
  },

  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      console.error('Lỗi đọc token từ localStorage:', e);
      return null;
    }
  },

  removeToken: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.error('Lỗi xóa token khỏi localStorage:', e);
    }
  },
};

export default tokenStorage;
