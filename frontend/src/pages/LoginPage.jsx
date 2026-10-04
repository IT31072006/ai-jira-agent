import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';
  const successMessage = location.state?.message || '';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Định dạng email không hợp lệ.');
      return;
    }

    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-badge">
            <Sparkles className="icon-sparkle" size={24} />
          </div>
          <h1 className="auth-title">AI Requirement-to-Jira</h1>
          <p className="auth-subtitle">Đăng nhập để quản lý và phân tách yêu cầu phần mềm</p>
        </div>

        {successMessage && (
          <div className="alert alert-success">
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Địa chỉ Email</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting}
            id="login-submit-button"
          >
            {isSubmitting ? (
              <span className="btn-loading-content">
                <span className="btn-spinner"></span>
                <span>Đang xử lý...</span>
              </span>
            ) : (
              <span className="btn-content">
                <span>Đăng nhập</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Chưa có tài khoản?{' '}
            <Link to="/register" className="auth-link">
              Đăng ký tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
