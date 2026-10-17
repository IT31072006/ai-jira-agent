const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const PasswordResetModel = require('../models/password-reset.model');
const EmailService = require('./email.service');
const { AuthNotificationService } = require('./auth-notification.service');

class AuthService {
  static validateRegistrationInput({ name, email, password }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const error = new Error('Họ và tên không được để trống.');
      error.statusCode = 400;
      throw error;
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const error = new Error('Email không hợp lệ.');
      error.statusCode = 400;
      throw error;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      const error = new Error('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      error.statusCode = 400;
      throw error;
    }
  }

  static validateLoginInput({ email, password }) {
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      const error = new Error('Email không được để trống.');
      error.statusCode = 400;
      throw error;
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      const error = new Error('Mật khẩu không được để trống.');
      error.statusCode = 400;
      throw error;
    }
  }

  static generateToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment variables.');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

    // JWT payload contains ONLY necessary info (userId, email)
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      secret,
      { expiresIn }
    );
  }

  static async register({ name, email, password }) {
    this.validateRegistrationInput({ name, email, password });

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      const error = new Error('Email này đã được đăng ký trong hệ thống.');
      error.statusCode = 409;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await UserModel.create({
      name,
      email,
      passwordHash,
    });

    // Kích hoạt webhook gửi email xác nhận sau khi đã lưu người dùng vào PostgreSQL thành công
    let emailConfirmation = {
      sent: false,
      reason: 'Chưa cấu hình dịch vụ n8n webhook',
    };

    try {
      emailConfirmation = await AuthNotificationService.sendRegistrationConfirmation(newUser);
    } catch (notifyErr) {
      console.warn('[AuthService] Lỗi ngoài dự kiến khi gửi thông báo xác nhận:', notifyErr.message);
      emailConfirmation = {
        sent: false,
        reason: notifyErr.message,
      };
    }

    return {
      message: 'Registration successful',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        created_at: newUser.created_at,
      },
      emailConfirmation,
    };
  }

  static async login({ email, password }) {
    this.validateLoginInput({ email, password });

    const user = await UserModel.findByEmail(email);
    if (!user) {
      const error = new Error('Email hoặc mật khẩu không chính xác.');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Email hoặc mật khẩu không chính xác.');
      error.statusCode = 401;
      throw error;
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    };
  }

  /**
   * Yêu cầu gửi mã xác nhận OTP để đặt lại mật khẩu
   */
  static async requestPasswordReset(email) {
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const error = new Error('Vui lòng cung cấp địa chỉ email hợp lệ.');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await UserModel.findByEmail(cleanEmail);

    // Để bảo mật (tránh account enumeration), nếu tài khoản không tồn tại,
    // ta vẫn trả về thông báo thành công chung để người dùng kiểm tra hộp thư
    if (!user) {
      console.warn(`[AuthService] Quên mật khẩu: Email ${cleanEmail} không tồn tại trong hệ thống.`);
      return {
        success: true,
        message: 'Nếu địa chỉ email này tồn tại trong hệ thống, bạn sẽ nhận được mã OTP trong giây lát.',
      };
    }

    // Sinh mã OTP 6 chữ số ngẫu nhiên bằng crypto
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await PasswordResetModel.createOtp({
      email: cleanEmail,
      otpCode,
      expiresAt,
    });

    // Soạn email thông báo OTP
    const subject = `[AI Jira Agent] Mã xác nhận đặt lại mật khẩu: ${otpCode}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { display: inline-block; font-size: 20px; font-weight: bold; color: #6366f1; letter-spacing: -0.5px; }
          .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 8px; margin-bottom: 8px; }
          .subtitle { font-size: 14px; color: #94a3b8; line-height: 1.5; }
          .otp-card { background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.15) 100%); border: 1px solid #6366f1; border-radius: 8px; text-align: center; padding: 24px; margin: 28px 0; }
          .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #818cf8; margin: 8px 0; }
          .otp-expiry { font-size: 13px; color: #cbd5e1; }
          .warning-text { font-size: 13px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #334155; padding-top: 20px; }
          .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">⚡ AI Jira Agent</div>
            <div class="title">Yêu cầu đặt lại mật khẩu</div>
            <div class="subtitle">Xin chào <strong>${user.name || cleanEmail}</strong>, chúng tôi đã nhận được yêu cầu cấp lại mật khẩu cho tài khoản của bạn.</div>
          </div>
          <div class="otp-card">
            <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Mã xác thực của bạn</div>
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">Mã này có hiệu lực trong vòng <strong>15 phút</strong>.</div>
          </div>
          <div class="warning-text">
            ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không cung cấp mã xác thực này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, xin vui lòng bỏ qua email và tài khoản của bạn vẫn an toàn.
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} AI Jira Agent. Mọi quyền được bảo lưu.
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Xin chào ${user.name || cleanEmail},\nMã xác thực đặt lại mật khẩu cho tài khoản của bạn là: ${otpCode}\nMã có hiệu lực trong vòng 15 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.`;

    const emailResult = await EmailService.sendEmail({
      to: cleanEmail,
      subject,
      html,
      text,
    });

    if (!emailResult.success) {
      console.error('[AuthService] Lỗi gửi email OTP:', emailResult.error);
      const error = new Error(emailResult.error || 'Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.');
      error.statusCode = emailResult.statusCode || 500;
      throw error;
    }

    return {
      success: true,
      message: 'Mã xác nhận gồm 6 số đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư đến (hoặc thư rác).',
    };
  }

  /**
   * Kiểm tra tính hợp lệ của mã xác nhận OTP trước khi cho phép nhập mật khẩu mới
   */
  static async verifyOtp({ email, otpCode }) {
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const error = new Error('Địa chỉ email không hợp lệ.');
      error.statusCode = 400;
      throw error;
    }

    if (!otpCode || String(otpCode).trim().length !== 6) {
      const error = new Error('Mã xác nhận OTP phải gồm đúng 6 chữ số.');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otpCode).trim();

    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      const error = new Error('Tài khoản người dùng không tồn tại.');
      error.statusCode = 404;
      throw error;
    }

    const validOtp = await PasswordResetModel.findValidOtp({
      email: cleanEmail,
      otpCode: cleanOtp,
    });

    if (!validOtp) {
      const error = new Error('Mã xác nhận OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.');
      error.statusCode = 400;
      throw error;
    }

    return {
      success: true,
      message: 'Xác thực mã OTP thành công. Vui lòng nhập mật khẩu mới.',
    };
  }

  /**
   * Xác thực mã OTP và tiến hành cập nhật mật khẩu mới
   */
  static async resetPassword({ email, otpCode, newPassword }) {
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const error = new Error('Địa chỉ email không hợp lệ.');
      error.statusCode = 400;
      throw error;
    }

    if (!otpCode || String(otpCode).trim().length !== 6) {
      const error = new Error('Mã xác nhận OTP phải gồm 6 chữ số.');
      error.statusCode = 400;
      throw error;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      const error = new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otpCode).trim();

    // 1. Kiểm tra tài khoản người dùng
    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      const error = new Error('Tài khoản người dùng không tồn tại.');
      error.statusCode = 404;
      throw error;
    }

    // 2. Kiểm tra mã OTP hợp lệ
    const validOtp = await PasswordResetModel.findValidOtp({
      email: cleanEmail,
      otpCode: cleanOtp,
    });

    if (!validOtp) {
      const error = new Error('Mã xác nhận OTP không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại hoặc yêu cầu mã mới.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 4. Cập nhật mật khẩu người dùng
    await UserModel.updatePassword(cleanEmail, passwordHash);

    // 5. Đánh dấu OTP đã sử dụng
    await PasswordResetModel.markUsed(validOtp.id);

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ bằng mật khẩu mới.',
    };
  }
}

module.exports = AuthService;
