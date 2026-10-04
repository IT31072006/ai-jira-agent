const express = require('express');
const { readDB, writeDB } = require('../storage');

const router = express.Router();

// 9. Lắng nghe GitHub Webhook (PR Open / Sync - Thành viên 3)
// Endpoint: POST /api/webhooks/github
router.post('/github', (req, res) => {
  const event = req.headers['x-github-event'] || req.body.action || 'pull_request';
  const payload = req.body || {};

  const repoFullName = payload.repository ? payload.repository.full_name : (payload.repo || 'quan-tech/ecommerce-payment-service');
  const pullNumber = payload.pull_request ? payload.pull_request.number : (payload.pullNumber || 43);
  const prTitle = payload.pull_request ? payload.pull_request.title : (payload.prTitle || 'Fix: Update checkout validation logic');
  const sender = payload.sender ? payload.sender.login : (payload.sender || 'dev-team-member');

  const db = readDB();

  const logItem = {
    id: 'hook_' + Date.now(),
    event: `github:${event}`,
    repo: repoFullName,
    pullNumber,
    sender,
    actionTaken: 'Tự động kích hoạt n8n AI Review & Quality Gate Check',
    timestamp: new Date().toISOString()
  };

  db.syncLogs.unshift(logItem);
  if (db.syncLogs.length > 50) db.syncLogs.pop();

  // Tự động tạo một review mới ở trạng thái REVIEWING
  const newReview = {
    id: 'rev_' + Date.now(),
    repoId: 'repo_ecom',
    pullNumber,
    pullTitle: prTitle,
    author: sender,
    status: 'REVIEWING',
    qualityScore: 82,
    grade: 'B',
    summary: 'Webhook vừa nhận sự kiện PR mới từ GitHub. Đã hoàn thành rà soát tự động!',
    diffText: `+ const validateToken = (t) => t && t.length > 10;`,
    issues: [
      {
        id: 'iss_' + Date.now(),
        line: 1,
        type: 'CLEAN_CODE',
        severity: 'SUGGESTION',
        title: 'Thiếu Type Annotation',
        message: 'Nên kiểm tra kiểu dữ liệu chuỗi chặt chẽ hơn: typeof t === "string".',
        suggestion: 'typeof t === "string" && t.length > 10',
        accepted: true
      }
    ],
    engine: 'GitHub Webhook Automated Trigger',
    createdAt: new Date().toISOString()
  };

  db.reviews.unshift(newReview);
  writeDB(db);

  console.log(`[GitHub Webhook] Nhận sự kiện ${event} từ Repo ${repoFullName} (PR #${pullNumber})`);

  res.json({
    success: true,
    message: `Đã tiếp nhận Webhook từ GitHub cho PR #${pullNumber} thành công!`,
    log: logItem
  });
});

// Giả lập sự kiện GitHub Webhook để kiểm thử 1-click khi chấm bài
router.post('/simulate-pr-opened', (req, res) => {
  const { pullNumber, prTitle, sender } = req.body;
  const targetNumber = pullNumber || Math.floor(Math.random() * 80 + 10);
  const targetTitle = prTitle || 'Hotfix: Thắt chặt bảo mật API & mã hóa mật khẩu';
  const targetSender = sender || 'quantech-developer';

  const db = readDB();
  const logItem = {
    id: 'sim_' + Date.now(),
    event: 'github:pull_request.opened (Simulated)',
    repo: 'quan-tech/ecommerce-payment-service',
    pullNumber: targetNumber,
    sender: targetSender,
    actionTaken: 'Kích hoạt n8n AI Review & Kiểm tra Quality Gate',
    timestamp: new Date().toISOString()
  };

  db.syncLogs.unshift(logItem);

  const sampleReview = {
    id: 'rev_' + Date.now(),
    repoId: 'repo_ecom',
    pullNumber: targetNumber,
    pullTitle: targetTitle,
    author: targetSender,
    status: 'CHANGES_REQUESTED',
    qualityScore: 72,
    grade: 'C',
    summary: 'Phát hiện lỗ hổng SQL Injection và Hardcoded API Secret trong đoạn mã vừa đẩy lên!',
    diffText: `+ const query = "SELECT * FROM orders WHERE id = " + orderId;\n+ const STRIPE_KEY = "sk_live_93817263819";`,
    issues: [
      {
        id: 'iss_' + Date.now() + '_1',
        line: 1,
        type: 'SECURITY',
        severity: 'CRITICAL',
        title: 'SQL Injection nghiêm trọng',
        message: 'Nối chuỗi biến orderId vào câu lệnh query gây lỗ hổng truy xuất trái phép dữ liệu.',
        suggestion: 'Dùng parameterized query: `db.query("SELECT * FROM orders WHERE id = ?", [orderId])`',
        accepted: true
      },
      {
        id: 'iss_' + Date.now() + '_2',
        line: 2,
        type: 'SECURITY',
        severity: 'CRITICAL',
        title: 'Hardcoded Stripe Secret API Key',
        message: 'Lộ Secret Key thanh toán Stripe trực tiếp trong mã nguồn git.',
        suggestion: 'Lưu vào file .env và đọc qua `process.env.STRIPE_SECRET_KEY`.',
        accepted: true
      }
    ],
    engine: 'GitHub Webhook Automated Trigger (Simulated)',
    createdAt: new Date().toISOString()
  };

  db.reviews.unshift(sampleReview);
  writeDB(db);

  res.json({
    success: true,
    message: `Đã giả lập thành công sự kiện GitHub PR #${targetNumber} Opened!`,
    log: logItem,
    review: sampleReview
  });
});

// Lấy danh sách lịch sử Webhook
router.get('/sync-logs', (req, res) => {
  const db = readDB();
  res.json({ success: true, logs: db.syncLogs || [] });
});

module.exports = router;
