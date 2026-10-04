const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Khởi tạo dữ liệu mẫu cho hệ thống AI-Powered Code Reviewer
  const initialData = {
    users: [
      {
        id: 'user_default',
        email: 'lead-dev@aicodereviewer.com',
        passwordHash: '$2a$10$wK1kKkI5k82oG8aP8t1q2u0B9eM.qQYp8mXb/gI4M2rW5zYxKzO7C',
        fullName: 'Nguyễn Văn Tech Lead',
        role: 'Tech Lead / Reviewer',
        createdAt: new Date().toISOString()
      }
    ],
    repositories: [
      {
        id: 'repo_ecom',
        userId: 'user_default',
        owner: 'quan-tech',
        name: 'ecommerce-payment-service',
        fullName: 'quan-tech/ecommerce-payment-service',
        defaultBranch: 'main',
        language: 'JavaScript / Node.js',
        description: 'Dịch vụ cổng thanh toán và xử lý đơn hàng trực tuyến',
        minQualityScore: 80,
        blockOnCritical: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'repo_bank',
        userId: 'user_default',
        owner: 'quan-tech',
        name: 'mobile-banking-backend',
        fullName: 'quan-tech/mobile-banking-backend',
        defaultBranch: 'develop',
        language: 'TypeScript',
        description: 'Core banking API & chuyển tiền liên ngân hàng',
        minQualityScore: 85,
        blockOnCritical: true,
        createdAt: new Date().toISOString()
      }
    ],
    apiConfigs: {
      repo_ecom: {
        githubToken: '',
        geminiKey: '',
        minQualityScore: 80,
        blockOnCritical: true,
        discordWebhookUrl: '',
        n8nReviewWebhookUrl: 'http://localhost:5678/webhook/review-code-diff',
        n8nCommentWebhookUrl: 'http://localhost:5678/webhook/comment-github-pr',
        n8nTestGenWebhookUrl: 'http://localhost:5678/webhook/generate-unit-tests'
      }
    },
    reviews: [
      {
        id: 'rev_101',
        repoId: 'repo_ecom',
        pullNumber: 42,
        pullTitle: 'Feature: Endpoint đăng nhập và xác thực JWT người dùng',
        author: 'Junior Developer A',
        status: 'CHANGES_REQUESTED', // 'APPROVED', 'CHANGES_REQUESTED', 'REVIEWING'
        qualityScore: 68,
        grade: 'C',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        reviewedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        engine: 'Gemini 2.0 Flash AI Reviewer',
        summary: 'Phát hiện 1 lỗi bảo mật nghiêm trọng (SQL Injection) và 1 trường hợp ghi log mật khẩu thô. Cần khắc phục trước khi merge vào nhánh main.',
        diffText: `diff --git a/src/controllers/auth.js b/src/controllers/auth.js
index 8a34bc1..9f82d1a 100644
--- a/src/controllers/auth.js
+++ b/src/controllers/auth.js
@@ -12,8 +12,14 @@ exports.login = async (req, res) => {
+  const { username, password } = req.body;
+  // LỖ HỔNG BẢO MẬT: Nối chuỗi trực tiếp
+  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
+  const user = await db.query(query);
+  console.log("Raw user password received:", password);
+  const token = jwt.sign({ id: user.id }, "secret123", { expiresIn: 3600000 });
+  return res.json({ token });
 }`,
        issues: [
          {
            id: 'iss_1',
            line: 15,
            type: 'SECURITY',
            severity: 'CRITICAL',
            title: 'Lỗ hổng SQL Injection nghiêm trọng',
            message: 'Tham số `username` và `password` được nối chuỗi trực tiếp vào câu lệnh SQL, cho phép kẻ tấn công vượt qua xác thực bằng payload: "\' OR 1=1 --".',
            suggestion: 'Sử dụng Parameterized Queries hoặc Prepared Statements (ví dụ: `db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, hashedPassword])`).',
            accepted: true
          },
          {
            id: 'iss_2',
            line: 17,
            type: 'SECURITY',
            severity: 'WARNING',
            title: 'Rò rỉ thông tin nhạy cảm qua Console Log',
            message: 'Lệnh `console.log(password)` in mật khẩu chưa mã hóa ra file log máy chủ. Có nguy cơ lộ lọt dữ liệu khi phân quyền log.',
            suggestion: 'Xóa bỏ câu lệnh ghi log mật khẩu hoặc sử dụng logger có cơ chế mask dữ liệu.',
            accepted: true
          },
          {
            id: 'iss_3',
            line: 18,
            type: 'CLEAN_CODE',
            severity: 'SUGGESTION',
            title: 'Hardcoded Secret & Magic Number',
            message: 'Secret key "secret123" và thời gian hết hạn 3600000 nên được đưa vào biến môi trường process.env.',
            suggestion: 'Dùng `process.env.JWT_SECRET` và hằng số `TOKEN_EXPIRES_IN`.',
            accepted: false
          }
        ],
        unitTests: `describe('Auth Login Controller', () => {
  it('nên từ chối đăng nhập khi username có ký tự SQL Injection', async () => {
    const res = await request(app).post('/login').send({ username: "' OR 1=1 --", password: '123' });
    expect(res.status).toBe(400);
  });

  it('nên trả về token JWT hợp lệ khi thông tin đăng nhập đúng', async () => {
    const res = await request(app).post('/login').send({ username: 'valid_user', password: 'correct_password' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});`
      }
    ],
    syncLogs: [
      {
        id: 'hook_1',
        event: 'pull_request.opened',
        repo: 'quan-tech/ecommerce-payment-service',
        pullNumber: 42,
        sender: 'junior-dev-a',
        actionTaken: 'Tự động kích hoạt n8n AI Review',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    ]
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) initStorage();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Lỗi đọc database file:', err);
    return { users: [], repositories: [], apiConfigs: {}, reviews: [], syncLogs: [] };
  }
}

function writeDB(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readDB, writeDB, initStorage };
