import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import {
  Mail,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  // Step 1: Nhập email gửi OTP
  // Step 2: Nhập mã OTP và bấm xác nhận
  // Step 3: Sau khi xác nhận đúng mã, mới cho nhập mật khẩu mới
  // Step 4: Hoàn tất đổi mật khẩu thành công
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bộ đếm ngược gửi lại mã OTP (60s)
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // BƯỚC 1: Xử lý gửi yêu cầu mã OTP qua Email
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessInfo('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Địa chỉ email không đúng định dạng.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword(trimmedEmail);
      setSuccessInfo(res.message || 'Mã xác nhận 6 số đã được gửi đến email của bạn.');
      setStep(2);
      setResendCountdown(60); // Bắt đầu đếm ngược 60s
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể gửi mã xác nhận lúc này. Vui lòng kiểm tra lại email hoặc thử lại sau.';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gửi lại mã OTP khi đang ở Bước 2
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase());
      setSuccessInfo(res.message || 'Mã xác nhận mới đã được gửi lại vào email.');
      setResendCountdown(60);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể gửi lại mã xác nhận. Vui lòng thử lại sau.';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // BƯỚC 2: Xác nhận mã OTP đúng rồi MỚI cho sang bước nhập mật khẩu mới
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    const cleanOtp = otpCode.trim();
    if (!cleanOtp) {
      setError('Vui lòng nhập mã xác nhận OTP gồm 6 chữ số.');
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setError('Mã xác nhận OTP phải gồm đúng 6 chữ số.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.verifyOtp({
        email: email.trim().toLowerCase(),
        otpCode: cleanOtp,
      });

      setSuccessInfo(res.message || 'Xác thực mã OTP thành công! Mời bạn thiết lập mật khẩu mới.');
      setStep(3); // Chuyển sang Bước 3: Đổi mật khẩu
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Mã xác nhận OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // BƯỚC 3: Đặt mật khẩu mới sau khi mã OTP đã được xác nhận đúng
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otpCode: otpCode.trim(),
        newPassword,
      });

      setSuccessInfo(res.message || 'Đổi mật khẩu thành công!');
      setStep(4); // Chuyển sang Bước 4: Hoàn tất

      // Tự động chuyển hướng về trang Đăng nhập sau 2.5 giây
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.' },
        });
      }, 2500);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể cập nhật mật khẩu. Vui lòng thử lại sau.';
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
            {step === 3 ? (
              <ShieldCheck className="icon-sparkle" size={24} />
            ) : (
              <Sparkles className="icon-sparkle" size={24} />
            )}
          </div>
          <h1 className="auth-title">
            {step === 1 && 'Quên mật khẩu?'}
            {step === 2 && 'Xác nhận mã OTP'}
            {step === 3 && 'Đặt mật khẩu mới'}
            {step === 4 && 'Hoàn tất đổi mật khẩu'}
          </h1>
          <p className="auth-subtitle">
            {step === 1 && 'Nhập email tài khoản để nhận mã xác thực qua thư điện tử'}
            {step === 2 && (
              <span>
                Mã xác nhận 6 số đã được gửi tới <strong>{email}</strong>
              </span>
            )}
            {step === 3 && 'Mã xác nhận hợp lệ. Vui lòng thiết lập mật khẩu mới cho tài khoản của bạn.'}
            {step === 4 && 'Mật khẩu tài khoản của bạn đã được cập nhật an toàn thành công'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {successInfo && step !== 4 && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} className="alert-icon" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* BƯỚC 1: Form nhập email */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="reset-email">Địa chỉ Email tài khoản</label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={18} />
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isSubmitting}
              id="request-otp-button"
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner"></span>
                  <span>Đang gửi mã...</span>
                </span>
              ) : (
                <span className="btn-content">
                  <span>Gửi mã xác nhận</span>
                  <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>
        )}

        {/* BƯỚC 2: CHỈ nhập mã xác nhận OTP, nhấn xác nhận mã đúng rồi MỚI cho đổi mật khẩu */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="auth-form" noValidate>
            <div className="form-group">
              <div className="form-group-header">
                <label htmlFor="otp-code">Mã xác nhận OTP (6 số)</label>
                <button
                  type="button"
                  className="link-subtle"
                  onClick={() => {
                    setStep(1);
                    setError('');
                    setSuccessInfo('');
                  }}
                >
                  Đổi email khác
                </button>
              </div>
              <div className="input-with-icon">
                <KeyRound className="input-icon" size={18} />
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  disabled={isSubmitting}
                  autoFocus
                  className="otp-input-field"
                  required
                />
              </div>
              <div className="otp-resend-wrapper">
                <button
                  type="button"
                  className="btn-resend-otp"
                  onClick={handleResendOtp}
                  disabled={resendCountdown > 0 || isSubmitting}
                >
                  <RefreshCw size={14} className={isSubmitting ? 'icon-spin' : ''} />
                  {resendCountdown > 0
                    ? `Gửi lại mã sau ${resendCountdown}s`
                    : 'Chưa nhận được mã? Gửi lại'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isSubmitting}
              id="verify-otp-button"
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner"></span>
                  <span>Đang xác thực mã...</span>
                </span>
              ) : (
                <span className="btn-content">
                  <span>Xác nhận mã OTP</span>
                  <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>
        )}

        {/* BƯỚC 3: MỚI cho nhập mật khẩu mới và xác nhận mật khẩu */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="new-password">Mật khẩu mới</label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isSubmitting}
              id="confirm-reset-button"
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner"></span>
                  <span>Đang cập nhật mật khẩu...</span>
                </span>
              ) : (
                <span className="btn-content">
                  <span>Cập nhật mật khẩu mới</span>
                  <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>
        )}

        {/* BƯỚC 4: Màn hình chúc mừng thành công */}
        {step === 4 && (
          <div className="reset-success-card">
            <div className="success-icon-badge">
              <CheckCircle2 size={48} className="text-success" />
            </div>
            <h3>Đặt lại mật khẩu thành công!</h3>
            <p>Mật khẩu của bạn đã được thay đổi. Hệ thống đang chuyển hướng bạn về trang Đăng nhập...</p>
            <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '1.25rem' }}>
              Đến trang Đăng nhập ngay
            </Link>
          </div>
        )}

        {/* Footer chuyển về đăng nhập */}
        {step !== 4 && (
          <div className="auth-footer">
            <Link to="/login" className="auth-back-link">
              <ArrowLeft size={16} />
              <span>Quay lại trang Đăng nhập</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
