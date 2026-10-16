const nodemailer = require('nodemailer');

class EmailService {
  /**
   * Kiểm tra xem các biến môi trường SMTP cần thiết đã được cấu hình hay chưa
   */
  static isConfigured() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return Boolean(user && user.trim() && pass && pass.trim());
  }

  /**
   * Lấy cấu hình SMTP từ biến môi trường
   */
  static getConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
    const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
    const from = process.env.SMTP_FROM || (user ? `"AI Jira Agent" <${user}>` : '"AI Jira Agent" <no-reply@ai-jira-agent.local>');

    return { host, port, secure, user, pass, from };
  }

  /**
   * Gửi email thực tế qua giao thức SMTP (Gmail hoặc SMTP Server tùy cấu hình)
   */
  static async sendEmail({ to, subject, html, text }) {
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return {
        success: false,
        statusCode: 400,
        error: `Địa chỉ email người nhận không hợp lệ: ${to}`,
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        statusCode: 501,
        error: 'Chưa cấu hình thông tin SMTP Credentials (SMTP_USER, SMTP_PASS / Gmail App Password) trong file backend/.env. Vui lòng cấu hình để kích hoạt gửi email thực tế.',
      };
    }

    const { host, port, secure, user, pass, from } = this.getConfig();

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      console.log(`[EmailService] Đang gửi email qua SMTP [${host}:${port}] tới: ${to}...`);

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text || subject,
      });

      console.log(`[EmailService] Gửi email thành công! MessageId: ${info.messageId}`);

      return {
        success: true,
        statusCode: 200,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
      };
    } catch (error) {
      console.error(`[EmailService] Lỗi khi gửi mail qua SMTP:`, error.message);
      let descriptiveError = error.message;

      if (error.code === 'EAUTH' || error.responseCode === 535) {
        descriptiveError = `Lỗi xác thực Gmail SMTP (535): Tài khoản hoặc Mật khẩu ứng dụng (App Password) không chính xác. Hãy đảm bảo tài khoản Gmail đã bật 2FA và tạo Mật khẩu ứng dụng 16 ký tự.`;
      } else if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        descriptiveError = `Không thể kết nối đến máy chủ SMTP ${host}:${port} (${error.code}). Vui lòng kiểm tra lại cấu hình mạng hoặc cổng kết nối.`;
      }

      return {
        success: false,
        statusCode: 502,
        error: descriptiveError,
        rawCode: error.code,
      };
    }
  }
}

module.exports = EmailService;
