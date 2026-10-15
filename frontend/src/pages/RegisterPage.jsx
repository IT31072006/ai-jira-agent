import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Địa chỉ email không đúng định dạng.');
      return;
    }

    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      // Navigate to login with success message
      navigate('/login', {
        state: {
          message: 'Đăng ký tài khoản thành công! Vui lòng đăng nhập với thông tin vừa tạo.',
        },
      });
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Đăng ký không thành công. Vui lòng thử lại.';
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
          <h1 className="auth-title">Tạo tài khoản mới</h1>
          <p className="auth-subtitle">Bắt đầu trải nghiệm phân tách requirement tự động bằng AI</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="register-name">Họ và tên</label>
            <div className="input-with-icon">
              <User className="input-icon" size={18} />
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={isSubmitting}
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="register-email">Địa chỉ Email</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                id="register-email"
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
            <label htmlFor="register-password">Mật khẩu (tối thiểu 6 ký tự)</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                autoComplete="new-password"
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

          <div className="form-group">
            <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting}
            id="register-submit-button"
          >
            {isSubmitting ? (
              <span className="btn-loading-content">
                <span className="btn-spinner"></span>
                <span>Đang tạo tài khoản...</span>
              </span>
            ) : (
              <span className="btn-content">
                <span>Đăng ký</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Đã có tài khoản?{' '}
            <Link to="/login" className="auth-link">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
