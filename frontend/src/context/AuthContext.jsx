import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';
import { tokenStorage } from '../utils/tokenStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(tokenStorage.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = tokenStorage.getToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const data = await authApi.getCurrentUser();
        if (data && data.user) {
          setUser(data.user);
          setToken(storedToken);
        } else {
          tokenStorage.removeToken();
          setUser(null);
          setToken(null);
        }
      } catch (error) {
        console.warn('Phiên đăng nhập không hợp lệ hoặc đã hết hạn:', error?.response?.data?.message || error.message);
        tokenStorage.removeToken();
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    if (data && data.token && data.user) {
      tokenStorage.saveToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
    throw new Error('Dữ liệu đăng nhập không hợp lệ từ máy chủ.');
  };

  const register = async ({ name, email, password }) => {
    return await authApi.register({ name, email, password });
  };

  const logout = () => {
    tokenStorage.removeToken();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};

export default AuthContext;
