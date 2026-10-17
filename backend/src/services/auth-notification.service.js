const axios = require('axios');
const env = require('../config/env');

/**
 * Định dạng ngày giờ chuẩn múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 * Đảm bảo ngày giờ được trích xuất chính xác từ thời điểm created_at thực tế trong PostgreSQL.
 */
function formatVietnamDateTime(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();

  // Kiểm tra tính hợp lệ của timestamp
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const registeredDate = dateFormatter.format(validDate);
  const registeredTime = timeFormatter.format(validDate);

  return {
    iso: validDate.toISOString(),
    registeredDate,
    registeredTime,
    timeZone: 'Asia/Ho_Chi_Minh (UTC+7)',
    formattedDateTime: `${registeredTime} ngày ${registeredDate} (Giờ Việt Nam - UTC+7)`,
  };
}

/**
 * Tạo nội dung email xác nhận đăng ký tài khoản bằng tiếng Việt
 * Thân thiện, trang trọng và bảo mật cao
 */
function generateConfirmationEmail({ displayName, email, registeredDate, registeredTime, formattedDateTime }) {
  const subject = 'Xác nhận đăng ký tài khoản AI Jira Agent thành công';
  const name = displayName ? displayName.trim() : 'Quý khách';

  const text = `Xin chào ${name},

Chúc mừng bạn đã đăng ký tài khoản thành công tại hệ thống AI Jira Agent!

Dưới đây là thông tin chi tiết về tài khoản vừa tạo:
- Họ và tên: ${name}
- Địa chỉ email đăng ký: ${email}
- Thời gian đăng ký: ${registeredTime} ngày ${registeredDate} (Giờ Việt Nam - UTC+7)

Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ AI Jira Agent để tối ưu hóa quy trình phân tách yêu cầu và quản lý dự án Jira bằng AI.

LƯU Ý BẢO MẬT:
Nếu bạn không thực hiện đăng ký tài khoản này, vui lòng bỏ qua email hoặc liên hệ ngay với đội ngũ hỗ trợ kỹ thuật của chúng tôi qua địa chỉ: support@ai-jira-agent.local để được hỗ trợ bảo vệ tài khoản kịp thời.

Trân trọng,
Đội ngũ phát triển AI Jira Agent
https://ai-jira-agent.local`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; line-height: 1.6; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
    .intro { margin-bottom: 24px; font-size: 15px; color: #334155; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 600; text-align: right; }
    .security-notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 13.5px; color: #92400e; }
    .security-notice strong { color: #78350f; display: block; margin-bottom: 4px; }
    .footer { background: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12.5px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>AI Jira Agent</h1>
      <p>Hệ thống hỗ trợ phân tích yêu cầu phần mềm và quản lý Jira tự động</p>
    </div>
    <div class="content">
      <div class="greeting">Xin chào ${name},</div>
      <p class="intro">Chúc mừng bạn đã đăng ký tài khoản thành công! Dưới đây là thông tin chi tiết về tài khoản vừa được khởi tạo:</p>
      
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Họ và tên:</span>
          <span class="info-value">${name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email tài khoản:</span>
          <span class="info-value">${email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ngày đăng ký:</span>
          <span class="info-value">${registeredDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Thời gian đăng ký:</span>
          <span class="info-value">${registeredTime} (UTC+7)</span>
        </div>
        <div class="info-row">
          <span class="info-label">Múi giờ:</span>
          <span class="info-value">Asia/Ho_Chi_Minh</span>
        </div>
      </div>

      <p class="intro">Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ <strong>AI Jira Agent</strong>.</p>

      <div class="security-notice">
        <strong>LƯU Ý BẢO MẬT:</strong>
        Nếu bạn không thực hiện đăng ký tài khoản này, vui lòng bỏ qua email hoặc liên hệ với bộ phận hỗ trợ kỹ thuật qua email <a href="mailto:support@ai-jira-agent.local" style="color: #92400e; font-weight: 600;">support@ai-jira-agent.local</a> để được hỗ trợ bảo vệ tài khoản kịp thời.
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">Email này được gửi tự động từ hệ thống AI Jira Agent. Vui lòng không trả lời trực tiếp email này.</p>
      <p style="margin: 0;">&copy; 2026 AI Jira Agent. Tất cả các quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Gửi HTTP POST sang webhook n8n với cơ chế dự phòng fallback URL
 */
async function postToN8n(primaryUrl, payload, headers, timeout = 7000) {
  try {
    return await axios.post(primaryUrl, payload, { headers, timeout });
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (primaryUrl.includes('/webhook-test/')) {
        fallbackUrl = primaryUrl.replace('/webhook-test/', '/webhook/');
      } else if (primaryUrl.includes('/webhook/')) {
        fallbackUrl = primaryUrl.replace('/webhook/', '/webhook-test/');
      }
      if (fallbackUrl) {
        console.log(`[AuthNotificationService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, { headers, timeout });
      }
    }
    throw err;
  }
}

class AuthNotificationService {
  /**
   * Gửi sự kiện đăng ký người dùng sang n8n Webhook để n8n chuyển tiếp gửi email xác nhận.
   * TUYỆT ĐỐI KHÔNG GỬI mật khẩu, password hash, JWT hay API secret trong payload.
   * NON-BLOCKING: Nếu n8n chưa cấu hình hoặc gặp sự cố, tài khoản vẫn được bảo toàn an toàn trong PostgreSQL.
   */
  static async sendRegistrationConfirmation(user) {
    if (!user || !user.email) {
      return {
        sent: false,
        configured: false,
        reason: 'Dữ liệu người dùng không hợp lệ.',
      };
    }

    const webhookUrl = env.N8N_AUTH_WEBHOOK_URL ? env.N8N_AUTH_WEBHOOK_URL.trim() : '';

    if (!webhookUrl) {
      console.log(
        `[AuthNotificationService] N8N_AUTH_WEBHOOK_URL chưa được cấu hình. Bỏ qua gửi email xác nhận cho user [${user.id}]. Email chỉ được gửi khi webhook và dịch vụ email đã được cấu hình trong hệ thống.`
      );
      return {
        sent: false,
        configured: false,
        reason: 'N8N_AUTH_WEBHOOK_URL chưa được cấu hình trong file .env.',
      };
    }

    // Trích xuất ngày giờ đăng ký theo múi giờ Việt Nam từ created_at thực tế trong PostgreSQL
    const timeInfo = formatVietnamDateTime(user.created_at);

    // Chuẩn bị nội dung email song ngữ / tiếng Việt chuẩn mực
    const emailContent = generateConfirmationEmail({
      displayName: user.name,
      email: user.email,
      registeredDate: timeInfo.registeredDate,
      registeredTime: timeInfo.registeredTime,
      formattedDateTime: timeInfo.formattedDateTime,
    });

    // Payload chỉ chứa các trường cần thiết, tuyệt đối không có mật khẩu, token hay secret
    const payload = {
      eventType: 'REGISTER_SUCCESS',
      userId: user.id,
      email: user.email,
      displayName: user.name,
      registeredAt: user.created_at || timeInfo.iso,
      registrationDetails: {
        email: user.email,
        displayName: user.name,
        registeredDate: timeInfo.registeredDate,
        registeredTime: timeInfo.registeredTime,
        timeZone: timeInfo.timeZone,
        formattedDateTime: timeInfo.formattedDateTime,
      },
      emailTemplate: {
        subject: emailContent.subject,
        to: user.email,
        from: env.EMAIL_FROM,
        greeting: `Xin chào ${user.name || 'bạn'},`,
        html: emailContent.html,
        text: emailContent.text,
      },
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (env.N8N_WEBHOOK_SECRET) {
      headers['X-Webhook-Secret'] = env.N8N_WEBHOOK_SECRET;
    }

    try {
      console.log(
        `[AuthNotificationService] Đang kích hoạt webhook gửi email xác nhận đăng ký tới n8n [${webhookUrl}] cho email: ${user.email}...`
      );

      const response = await postToN8n(webhookUrl, payload, headers, 7000);

      const responseData = response.data;
      const isFailed = responseData && responseData.success === false;

      if (isFailed) {
        const errorMsg = responseData?.error || responseData?.message || 'n8n workflow xử lý email thất bại';
        console.warn(`[AuthNotificationService] n8n phản hồi lỗi khi gửi email xác nhận: ${errorMsg}`);
        return {
          sent: false,
          configured: true,
          reason: errorMsg,
          responseData,
        };
      }

      console.log(`[AuthNotificationService] Đã gửi sự kiện xác nhận đăng ký sang n8n thành công cho user [${user.id}]`);
      return {
        sent: true,
        configured: true,
        deliveredAt: new Date().toISOString(),
        responseData,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Lỗi kết nối tới n8n webhook';
      console.warn(
        `[AuthNotificationService] Không thể gửi webhook xác nhận đăng ký tới n8n (${errorMsg}). Tài khoản người dùng vẫn được tạo an toàn trong PostgreSQL.`
      );
      return {
        sent: false,
        configured: true,
        reason: `Lỗi kết nối webhook n8n: ${errorMsg}`,
      };
    }
  }
}

module.exports = {
  AuthNotificationService,
  formatVietnamDateTime,
  generateConfirmationEmail,
};
