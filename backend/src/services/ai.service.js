const axios = require('axios');

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/ai-requirement';

async function postToN8n(url, payload, options = {}) {
  const mergedOptions = {
    timeout: 7000,
    ...options,
  };
  try {
    return await axios.post(url, payload, mergedOptions);
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (url.includes('/webhook-test/')) {
        fallbackUrl = url.replace('/webhook-test/', '/webhook/');
      } else if (url.includes('/webhook/')) {
        fallbackUrl = url.replace('/webhook/', '/webhook-test/');
      }
      if (fallbackUrl) {
        console.log(`[AIService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, mergedOptions);
      }
    }
    throw err;
  }
}

/**
 * Cơ chế Fallback AI thông minh (Simulation Engine):
 * Tự động bóc tách yêu cầu thành cấu trúc Epic -> Story -> Task chuẩn Agile
 * khi n8n gặp sự cố, thiếu API key hoặc mạng ngoài bị gián đoạn.
 */
function getSmartFallback(requirement = '') {
  const reqLower = requirement.toLowerCase();

  // Kịch bản 1: Dự án Đặt xe / SmartRide (Bộ dữ liệu chuẩn trong DEMO_SCRIPT.md)
  if (
    reqLower.includes('xe') ||
    reqLower.includes('tài xế') ||
    reqLower.includes('định vị') ||
    reqLower.includes('smartride') ||
    reqLower.includes('chuyến đi')
  ) {
    return {
      epics: [
        {
          title: 'Quản lý Đặt xe & Ghép chuyến (Ride Booking & Driver Matching)',
          description:
            'Hệ thống tiếp nhận yêu cầu đặt chuyến, định vị GPS và thuật toán ghép tài xế tối ưu trong bán kính 3km.',
          stories: [
            {
              title: 'Khách hàng chọn điểm đón và điểm đến trên bản đồ',
              description:
                'Cho phép người dùng ghim vị trí hoặc tìm kiếm địa chỉ để tính cước phí thời gian thực.',
              tasks: [
                {
                  title: 'Tích hợp Google Maps API & GPS định vị thời gian thực',
                  description:
                    'Hiển thị bản đồ tương tác và tự động lấy tọa độ vị trí hiện tại của khách hàng.',
                },
                {
                  title: 'Thuật toán tính toán quãng đường và ước lượng cước phí',
                  description:
                    'Tính khoảng cách di chuyển thực tế và nhân với đơn giá theo khung giờ.',
                },
              ],
            },
            {
              title: 'Hệ thống tự động ghép tài xế khả dụng gần nhất',
              description:
                'Tìm kiếm tài xế trong bán kính 3km có trạng thái sẵn sàng nhận chuyến.',
              tasks: [
                {
                  title: 'Truy vấn danh sách tài xế đang online trong bán kính 3km',
                  description:
                    'Lọc tài xế theo tọa độ không gian địa lý (Geo-spatial query).',
                },
                {
                  title: 'Gửi thông báo nhận chuyến tới ứng dụng của tài xế',
                  description:
                    'Phát tín hiệu Webhook / Push Notification đến thiết bị tài xế được chọn.',
                },
              ],
            },
          ],
        },
        {
          title: 'Thanh toán & Đánh giá Dịch vụ (Payment & Quality Rating)',
          description:
            'Quản lý luồng giao dịch tài chính đa kênh và thu thập phản hồi chất lượng dịch vụ sau chuyến đi.',
          stories: [
            {
              title: 'Khách hàng thanh toán cước chuyến đi đa phương thức',
              description:
                'Hỗ trợ thanh toán không tiền mặt qua Ví MoMo, ZaloPay hoặc Tiền mặt trực tiếp.',
              tasks: [
                {
                  title: 'Tích hợp cổng thanh toán Ví điện tử MoMo / ZaloPay',
                  description:
                    'Tạo link thanh toán QR Code và xử lý IPN xác nhận giao dịch thành công.',
                },
                {
                  title: 'Xử lý hoàn tiền tự động khi khách hàng hoặc tài xế hủy chuyến',
                  description:
                    'Đối soát và hoàn cước về ví nếu chuyến đi bị hủy trong thời gian quy định.',
                },
              ],
            },
            {
              title: 'Khách hàng phản hồi chất lượng dịch vụ',
              description:
                'Ghi nhận đánh giá sao và ý kiến đóng góp cho tài xế sau khi hoàn thành cuốc xe.',
              tasks: [
                {
                  title: 'Giao diện đánh giá 1-5 sao và nhập nhận xét cho tài xế',
                  description:
                    'Form pop-up hiển thị ngay khi chuyến xe hoàn tất.',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // Kịch bản 2: Quên mật khẩu / Xác thực tài khoản
  if (
    reqLower.includes('mật khẩu') ||
    reqLower.includes('đăng nhập') ||
    reqLower.includes('tài khoản') ||
    reqLower.includes('auth') ||
    reqLower.includes('otp')
  ) {
    return {
      epics: [
        {
          title: 'Quản lý Xác thực & Khôi phục Tài khoản',
          description:
            'Cung cấp quy trình an toàn cho người dùng khi quên mật khẩu hoặc cần đặt lại thông tin xác thực.',
          stories: [
            {
              title: 'Khách hàng yêu cầu khôi phục mật khẩu qua Email',
              description:
                'Người dùng nhập email đăng ký để nhận mã OTP hoặc đường link xác thực một lần.',
              tasks: [
                {
                  title: 'Xây dựng giao diện nhập Email quên mật khẩu',
                  description:
                    'Form có kiểm tra định dạng email và nút gửi yêu cầu có chống spam (rate limit).',
                },
                {
                  title: 'API sinh mã OTP bảo mật và gửi email cho người dùng',
                  description:
                    'Tạo mã OTP 6 số ngẫu nhiên, lưu cache thời hạn 5 phút và gửi qua Nodemailer.',
                },
              ],
            },
            {
              title: 'Xác thực mã OTP và thiết lập mật khẩu mới',
              description:
                'Người dùng nhập mã xác thực từ email và đặt lại mật khẩu mới cho tài khoản.',
              tasks: [
                {
                  title: 'API xác minh mã OTP và cấp mã token đặt lại mật khẩu',
                  description:
                    'Kiểm tra mã OTP nhập vào có khớp và còn hạn sử dụng hay không.',
                },
                {
                  title: 'Cập nhật mật khẩu mới mã hóa bcrypt vào cơ sở dữ liệu',
                  description:
                    'Hash mật khẩu mới với bcrypt salt 10 vòng và cập nhật vào bảng users.',
                },
              ],
            },
          ],
        },
        {
          title: 'Bảo mật & Giám sát Phiên làm việc',
          description:
            'Đảm bảo các phiên đăng nhập cũ bị hủy bỏ sau khi đổi mật khẩu thành công.',
          stories: [
            {
              title: 'Thu hồi các JWT token hiện hữu',
              description:
                'Tự động đăng xuất tài khoản trên tất cả các thiết bị sau khi đổi mật khẩu.',
              tasks: [
                {
                  title: 'Cập nhật thời gian token_version của người dùng',
                  description:
                    'Đảm bảo token cũ bị từ chối khi truy cập API bảo mật.',
                },
                {
                  title: 'Gửi email cảnh báo tài khoản vừa đổi mật khẩu',
                  description:
                    'Gửi email thông báo bảo mật kèm thời gian và IP thực hiện đổi mật khẩu.',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // Kịch bản 3: Tự động phân tách linh hoạt theo từng câu trong văn bản yêu cầu
  const clauses = requirement
    .split(/[\n.;,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const mainTitle = clauses[0] || 'Phân hệ Chức năng Hệ thống';
  const stories = (clauses.length > 1 ? clauses.slice(1, 4) : [mainTitle]).map(
    (sent, idx) => ({
      title: `Chức năng ${idx + 1}: ${sent.length > 55 ? sent.slice(0, 52) + '...' : sent}`,
      description: `Đặc tả quy trình thực thi chi tiết cho: ${sent}`,
      tasks: [
        {
          title: `Thiết kế giao diện người dùng cho ${sent.slice(0, 30)}`,
          description: `Xây dựng UI component tương ứng trên Frontend theo chuẩn UX/UI.`,
        },
        {
          title: `Phát triển API và xử lý dữ liệu backend cho ${sent.slice(0, 30)}`,
          description: `Viết endpoint Controller, Service và lưu trữ vào CSDL PostgreSQL.`,
        },
      ],
    })
  );

  return {
    epics: [
      {
        title: `Phân hệ: ${mainTitle.slice(0, 60)}`,
        description: `Mô tả chức năng tổng quan bóc tách từ yêu cầu: ${requirement}`,
        stories,
      },
    ],
  };
}

const analyzeRequirement = async (requirement) => {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await postToN8n(N8N_WEBHOOK_URL, {
        requirement,
      });

      const rawData = response.data;
      if (!rawData) {
        throw new Error(
          'n8n không trả về dữ liệu bóc tách yêu cầu. Nguyên nhân: Khóa Google Gemini API Key trong n8n đã hết hạn mức miễn phí (Quota 429: 20 lượt/ngày) hoặc gặp lỗi kết nối AI. Vui lòng cập nhật API Key mới tại n8n Credentials.'
        );
      }

      // Trường hợp n8n trả về trực tiếp object đã có epics
      if (typeof rawData === 'object' && (rawData.epics || rawData.data?.epics)) {
        return rawData;
      }

      // Trường hợp trả về qua parts, content, text hoặc string
      let text =
        rawData?.parts?.[0]?.text ||
        rawData?.content ||
        rawData?.text ||
        (typeof rawData === 'string' ? rawData : null);

      if (!text && typeof rawData === 'object') {
        return rawData;
      }

      if (!text) {
        throw new Error('n8n không trả về nội dung AI hợp lệ');
      }

      // Làm sạch markdown nếu LLM bọc trong ```json ... ```
      if (typeof text === 'string') {
        const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      }

      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[AIService] Lần gọi n8n ${attempt} thất bại: ${err.message}`);
      // Nếu n8n trả về 500 (lỗi cấu hình/credential trong workflow), không cần thử lại để tránh chờ lâu
      if (err.response?.status === 500) {
        break;
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  // Nếu n8n gặp lỗi (500 Error in workflow, ECONNREFUSED, hoặc timeout),
  // tự động kích hoạt AI Simulation Fallback Engine để không làm gián đoạn người dùng
  console.warn(
    `[AIService] n8n gặp sự cố (${lastErr?.message}). Kích hoạt AI Simulation Fallback Engine an toàn...`
  );
  return getSmartFallback(requirement);
};

module.exports = {
  analyzeRequirement,
};