const http = require('http');
const axios = require('axios');
const db = require('../config/db');
const UserModel = require('../models/user.model');
const AuthService = require('../services/auth.service');
const {
  AuthNotificationService,
  formatVietnamDateTime,
  generateConfirmationEmail,
} = require('../services/auth-notification.service');
const env = require('../config/env');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ TÍCH HỢP: XÁC NHẬN ĐĂNG KÝ VÀ WEBHOOK EMAIL N8N');
  console.log('======================================================================\n');

  // 1. Kiểm thử định dạng múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
  console.log('--- TEST GROUP 1: Format Múi Giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7) ---');
  {
    // Cố định 1 mốc thời gian UTC: 2026-10-17T04:15:30.000Z => Việt Nam (UTC+7) phải là 11:15:30 17/10/2026
    const fixedUtcDate = new Date('2026-10-17T04:15:30.000Z');
    const timeInfo = formatVietnamDateTime(fixedUtcDate);

    assert(timeInfo.registeredDate === '17/10/2026', `Định dạng ngày Việt Nam phải là 17/10/2026 (Nhận được: ${timeInfo.registeredDate})`);
    assert(timeInfo.registeredTime === '11:15:30', `Định dạng giờ Việt Nam phải là 11:15:30 (Nhận được: ${timeInfo.registeredTime})`);
    assert(timeInfo.timeZone.includes('Asia/Ho_Chi_Minh'), 'Chứa định danh timezone Asia/Ho_Chi_Minh');
    assert(timeInfo.formattedDateTime.includes('11:15:30 ngày 17/10/2026'), 'Chuỗi ngày giờ hoàn chỉnh đúng chuẩn');
  }

  // 2. Kiểm thử nội dung email xác nhận (Bảo mật & Tiếng Việt)
  console.log('\n--- TEST GROUP 2: Nội Dung Template Email Xác Nhận ---');
  {
    const emailData = generateConfirmationEmail({
      displayName: 'Nguyễn Văn Kiểm Thử',
      email: 'test.user@example.com',
      registeredDate: '17/10/2026',
      registeredTime: '11:15:30',
      formattedDateTime: '11:15:30 ngày 17/10/2026 (Giờ Việt Nam - UTC+7)',
    });

    assert(
      emailData.subject === 'Xác nhận đăng ký tài khoản AI Jira Agent thành công',
      'Tiêu đề email đúng theo yêu cầu: "Xác nhận đăng ký tài khoản AI Jira Agent thành công"'
    );
    assert(emailData.text.includes('Xin chào Nguyễn Văn Kiểm Thử'), 'Email text có lời chào người dùng');
    assert(emailData.text.includes('test.user@example.com'), 'Email text chứa đúng email người dùng');
    assert(emailData.text.includes('17/10/2026'), 'Email text chứa ngày đăng ký');
    assert(emailData.text.includes('11:15:30'), 'Email text chứa giờ đăng ký');
    assert(emailData.text.includes('Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ AI Jira Agent'), 'Email text chứa lời cảm ơn');
    assert(
      emailData.text.includes('Nếu bạn không thực hiện đăng ký tài khoản này'),
      'Email text chứa hướng dẫn an toàn nếu người dùng không thực hiện đăng ký'
    );

    // Kiểm tra tính bảo mật: tuyệt đối không chứa password, hash, JWT hay secret
    assert(!emailData.text.toLowerCase().includes('password_hash'), 'Email không chứa password_hash');
    assert(!emailData.html.toLowerCase().includes('jwt_secret'), 'Email không chứa secret key');
    assert(emailData.html.includes('Nguyễn Văn Kiểm Thử') && emailData.html.includes('test.user@example.com'), 'Email HTML render đúng thông tin');
  }

  // 3. Khởi tạo một Mock Server HTTP cục bộ để kiểm tra Webhook n8n
  console.log('\n--- TEST GROUP 3: Kiểm thử luồng gửi Webhook sang n8n khi Đăng Ký ---');
  let receivedWebhookPayload = null;
  let receivedWebhookHeaders = null;
  let mockServerStatus = 200;

  const mockN8nServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      receivedWebhookHeaders = req.headers;
      try {
        receivedWebhookPayload = JSON.parse(body);
      } catch (e) {
        receivedWebhookPayload = body;
      }

      if (mockServerStatus === 200) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Webhook received by n8n' }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal n8n workflow error' }));
      }
    });
  });

  const MOCK_PORT = 5899;
  await new Promise((resolve) => mockN8nServer.listen(MOCK_PORT, resolve));

  // Tạm thời cấu hình env webhook trỏ vào mock server
  const originalWebhookUrl = process.env.N8N_AUTH_WEBHOOK_URL;
  const originalSecret = process.env.N8N_WEBHOOK_SECRET;
  process.env.N8N_AUTH_WEBHOOK_URL = `http://localhost:${MOCK_PORT}/webhook/auth-registration`;
  process.env.N8N_WEBHOOK_SECRET = 'test_secret_key_12345';
  env.N8N_AUTH_WEBHOOK_URL = `http://localhost:${MOCK_PORT}/webhook/auth-registration`;
  env.N8N_WEBHOOK_SECRET = 'test_secret_key_12345';

  const testEmail1 = `test_success_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Lê Văn Thành Công';

  try {
    // Kịch bản A: Đăng ký thành công & Webhook n8n nhận dữ liệu hợp lệ
    mockServerStatus = 200;
    receivedWebhookPayload = null;

    const registerResult = await AuthService.register({
      name: testName,
      email: testEmail1,
      password: testPassword,
    });

    assert(registerResult.message === 'Registration successful', 'AuthService.register trả về message thành công');
    assert(registerResult.user && registerResult.user.id, 'User có ID hợp lệ trả về từ PostgreSQL');
    assert(registerResult.user.email === testEmail1.toLowerCase(), 'Email user được lưu đúng');
    assert(registerResult.emailConfirmation.sent === true, 'emailConfirmation.sent là true khi n8n phản hồi thành công');

    // Kiểm tra dữ liệu được lưu vào database PostgreSQL
    const savedUser = await UserModel.findByEmail(testEmail1);
    assert(savedUser !== null, 'Tài khoản đã được lưu vào cơ sở dữ liệu PostgreSQL');
    assert(savedUser.password_hash !== testPassword, 'Mật khẩu đã được hash bằng bcrypt, không lưu plain text');

    // Kiểm tra Webhook Payload được gửi đến Mock n8n Server
    assert(receivedWebhookPayload !== null, 'n8n mock server đã nhận được HTTP POST webhook');
    assert(receivedWebhookPayload.eventType === 'REGISTER_SUCCESS', 'eventType là REGISTER_SUCCESS theo chuẩn Luồng 1');
    assert(receivedWebhookPayload.userId === savedUser.id, 'userId trong payload khớp với ID trong database');
    assert(receivedWebhookPayload.email === testEmail1.toLowerCase(), 'email trong payload khớp');
    assert(receivedWebhookPayload.displayName === testName, 'displayName trong payload khớp');
    assert(receivedWebhookPayload.registeredAt !== undefined, 'registeredAt có trong payload');
    assert(receivedWebhookPayload.registrationDetails.registeredDate !== undefined, 'registrationDetails có ngày đăng ký theo giờ VN');
    assert(receivedWebhookPayload.emailTemplate.subject === 'Xác nhận đăng ký tài khoản AI Jira Agent thành công', 'emailTemplate có tiêu đề chuẩn');

    // Kiểm tra bảo mật payload: KHÔNG CHỨA password, hash, JWT hay secret
    assert(receivedWebhookPayload.password === undefined, 'Payload không chứa trường password');
    assert(receivedWebhookPayload.passwordHash === undefined, 'Payload không chứa passwordHash');
    assert(receivedWebhookPayload.token === undefined, 'Payload không chứa JWT token');
    assert(receivedWebhookHeaders['x-webhook-secret'] === 'test_secret_key_12345', 'Header X-Webhook-Secret được truyền đúng');

    // Kịch bản B: Đăng ký lại với cùng email (Email đã tồn tại - 409)
    console.log('\n--- TEST GROUP 4: Kiểm thử Email đã tồn tại (Không gửi Webhook) ---');
    receivedWebhookPayload = null;
    let duplicateError = null;
    try {
      await AuthService.register({
        name: 'Người Trùng Email',
        email: testEmail1,
        password: 'OtherPassword123',
      });
    } catch (err) {
      duplicateError = err;
    }

    assert(duplicateError !== null, 'Phát sinh lỗi khi đăng ký trùng email');
    assert(duplicateError.statusCode === 409, 'Status code trả về là 409 Conflict');
    assert(duplicateError.message.includes('Email này đã được đăng ký'), 'Thông báo lỗi tiếng Việt rõ ràng');
    assert(receivedWebhookPayload === null, 'Tuyệt đối KHÔNG gửi webhook khi đăng ký trùng email thất bại');

    // Kịch bản C: Dữ liệu đăng ký không hợp lệ (Validation Failure - 400)
    console.log('\n--- TEST GROUP 5: Kiểm thử Dữ Liệu Không Hợp Lệ (Không gửi Webhook) ---');
    receivedWebhookPayload = null;
    let validationError = null;
    try {
      await AuthService.register({
        name: '',
        email: 'invalid-email',
        password: '123',
      });
    } catch (err) {
      validationError = err;
    }

    assert(validationError !== null, 'Phát sinh lỗi validation');
    assert(validationError.statusCode === 400, 'Status code trả về là 400 Bad Request');
    assert(receivedWebhookPayload === null, 'Tuyệt đối KHÔNG gửi webhook khi dữ liệu đầu vào không hợp lệ');

    // Kịch bản D: Webhook n8n bị lỗi / offline (Non-blocking: DB vẫn lưu, không xóa user)
    console.log('\n--- TEST GROUP 6: Kiểm thử Webhook n8n Lỗi / Offline (Non-blocking) ---');
    mockServerStatus = 500; // Mock n8n bị lỗi 500
    const testEmail2 = `test_n8n_fail_${Date.now()}@example.com`;

    const resultWithN8nError = await AuthService.register({
      name: 'Trần Văn Fallback',
      email: testEmail2,
      password: testPassword,
    });

    assert(resultWithN8nError.message === 'Registration successful', 'Đăng ký vẫn thành công dù webhook n8n lỗi');
    assert(resultWithN8nError.user && resultWithN8nError.user.id, 'User vẫn được tạo');
    assert(resultWithN8nError.emailConfirmation.sent === false, 'emailConfirmation.sent là false (không giả vờ gửi thành công)');
    assert(resultWithN8nError.emailConfirmation.reason !== undefined, 'Có lý do lỗi rõ ràng để debug/retry');

    // Kiểm tra user vẫn được bảo toàn trong PostgreSQL, không bị xóa
    const userInDb = await UserModel.findByEmail(testEmail2);
    assert(userInDb !== null, 'Tài khoản người dùng vẫn được lưu an toàn trong PostgreSQL');

    // Dọn dẹp dữ liệu test
    await db.query('DELETE FROM users WHERE email IN ($1, $2)', [testEmail1.toLowerCase(), testEmail2.toLowerCase()]);
    console.log('  ✓ Đã dọn dẹp các tài khoản kiểm thử trong database');

  } finally {
    // Đóng mock server và khôi phục biến môi trường
    await new Promise((resolve) => mockN8nServer.close(resolve));
    process.env.N8N_AUTH_WEBHOOK_URL = originalWebhookUrl;
    process.env.N8N_WEBHOOK_SECRET = originalSecret;
    env.N8N_AUTH_WEBHOOK_URL = originalWebhookUrl;
    env.N8N_WEBHOOK_SECRET = originalSecret;
  }

  // 4. Kiểm thử qua HTTP Endpoint thực tế của Express Server (POST /api/auth/register)
  console.log('\n--- TEST GROUP 7: Kiểm thử thực tế qua HTTP Endpoint /api/auth/register ---');
  const app = require('../app');
  let testServer = null;
  try {
    await axios.get('http://localhost:5000/health');
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      await new Promise((resolve) => {
        testServer = app.listen(5000, () => resolve());
      });
    }
  }

  const testEmailHttp = `http_test_${Date.now()}@example.com`;
  try {
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Người Dùng Test API',
      email: testEmailHttp,
      password: 'Password123!',
    });

    assert(res.status === 201, `Status code HTTP phải là 201 Created (Nhận: ${res.status})`);
    assert(res.data.message === 'Registration successful', 'Response message là Registration successful');
    assert(res.data.user && res.data.user.email === testEmailHttp.toLowerCase(), 'Response trả về thông tin user');
    assert(res.data.emailConfirmation !== undefined, 'Response có trường emailConfirmation');
    console.log('  ✓ Trạng thái email xác nhận nhận từ server:', JSON.stringify(res.data.emailConfirmation));

    // Dọn dẹp user test
    await db.query('DELETE FROM users WHERE email = $1', [testEmailHttp.toLowerCase()]);
    console.log('  ✓ Đã dọn dẹp user test HTTP');
  } catch (httpErr) {
    console.error('  ✗ Lỗi khi gọi POST /api/auth/register:', httpErr.response?.data || httpErr.message);
    failedTests++;
  } finally {
    if (testServer) {
      if (typeof testServer.closeAllConnections === 'function') {
        testServer.closeAllConnections();
      }
      await new Promise((resolve) => testServer.close(resolve));
    }
  }

  console.log('\n======================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} PASSED / ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
