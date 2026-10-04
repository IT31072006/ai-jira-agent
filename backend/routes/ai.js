const express = require('express');
const axios = require('axios');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// Fallback phân tích bảo mật khi offline hoặc demo nhanh
function generateFallbackSecurityReview(diffText, language) {
  const issues = [];
  let score = 92;

  if (diffText.includes('SELECT') && (diffText.includes('+') || diffText.includes('${') || diffText.includes('" + '))) {
    issues.push({
      id: 'iss_' + Date.now() + '_1',
      line: 14,
      type: 'SECURITY',
      severity: 'CRITICAL',
      title: 'Lỗ hổng SQL Injection (CWE-89)',
      message: 'Phát hiện nối chuỗi trực tiếp dữ liệu người dùng vào câu lệnh SQL mà không qua escaping/parameterized queries.',
      suggestion: 'Thay thế bằng prepared statement: `db.query("SELECT * FROM users WHERE id = ?", [userId])`',
      accepted: true
    });
    score -= 25;
  }

  if (diffText.includes('console.log') || diffText.includes('password') || diffText.includes('token') || diffText.includes('secret')) {
    issues.push({
      id: 'iss_' + Date.now() + '_2',
      line: 18,
      type: 'SECURITY',
      severity: 'WARNING',
      title: 'Nguy cơ rò rỉ dữ liệu nhạy cảm (CWE-532)',
      message: 'In biến nhạy cảm hoặc mật khẩu ra console/log hệ thống.',
      suggestion: 'Xóa bỏ console.log trước khi đẩy lên production hoặc băm dữ liệu.',
      accepted: true
    });
    score -= 10;
  }

  if (diffText.includes('3600000') || diffText.includes('86400') || diffText.includes('1000')) {
    issues.push({
      id: 'iss_' + Date.now() + '_3',
      line: 22,
      type: 'CLEAN_CODE',
      severity: 'SUGGESTION',
      title: 'Magic Number không rõ ngữ cảnh',
      message: 'Giá trị thời gian hoặc số nguyên cố định nên được định nghĩa thành hằng số (CONSTANT) rõ nghĩa.',
      suggestion: 'Khai báo: `const ONE_HOUR_IN_MS = 3600000;`',
      accepted: false
    });
    score -= 5;
  }

  const grade = score >= 90 ? 'A' : (score >= 80 ? 'B' : (score >= 65 ? 'C' : 'D'));

  return {
    qualityScore: Math.max(40, score),
    grade,
    summary: issues.length > 0
      ? `Phát hiện ${issues.length} vấn đề cần lưu ý, bao gồm ${issues.filter(i => i.severity === 'CRITICAL').length} lỗi bảo mật mức nghiêm trọng.`
      : 'Mã nguồn được viết sạch, tuân thủ tiêu chuẩn an toàn và clean code!',
    issues
  };
}

// 4. Gửi yêu cầu phân tích Code Diff (Core AI - Thành viên 2)
// Gọi n8n Webhook, nếu n8n chưa mở thì gọi trực tiếp Gemini hoặc Fallback Engine
router.post('/review-diff', verifyToken, async (req, res) => {
  const { repoId, pullNumber, pullTitle, diffText, language } = req.body;

  if (!diffText || diffText.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đoạn git diff hoặc code cần review' });
  }

  const db = readDB();
  const config = db.apiConfigs[repoId] || {};
  const n8nUrl = config.n8nReviewWebhookUrl || 'http://localhost:5678/webhook/review-code-diff';
  const geminiKey = config.geminiKey || process.env.GEMINI_API_KEY;

  let reviewData = null;
  let processingEngine = '';

  // BƯỚC 1: Thử gọi Webhook n8n
  try {
    console.log(`[AI Review] Đang gọi Webhook n8n tại: ${n8nUrl}...`);
    const n8nRes = await axios.post(n8nUrl, {
      diffText,
      language: language || 'javascript',
      geminiApiKey: geminiKey
    }, { timeout: 8000 });

    if (n8nRes.data && n8nRes.data.data) {
      reviewData = n8nRes.data.data;
      processingEngine = 'n8n Automation Engine';
    }
  } catch (n8nErr) {
    console.log(`[AI Review] n8n Webhook chưa mở. Chuyển sang Gemini Direct: ${n8nErr.message}`);
  }

  // BƯỚC 2: Gọi Gemini API trực tiếp nếu có key
  if (!reviewData && geminiKey) {
    try {
      const prompt = `Bạn là Senior Principal Security & Code Reviewer.
Hãy phân tích đoạn git diff sau và trả về JSON thuần túy theo schema:
{
  "qualityScore": 85,
  "grade": "B",
  "summary": "Tóm tắt đánh giá chất lượng",
  "issues": [
    {
      "id": "iss_1",
      "line": 14,
      "type": "SECURITY",
      "severity": "CRITICAL",
      "title": "Lỗ hổng SQL Injection",
      "message": "Chi tiết vấn đề",
      "suggestion": "Cách sửa cụ thể"
    }
  ]
}

NGÔN NGỮ: ${language || 'javascript'}
DIFF:
${diffText}`;

      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        },
        { timeout: 15000 }
      );

      let raw = geminiRes.data.candidates[0].content.parts[0].text;
      raw = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
      reviewData = JSON.parse(raw);
      processingEngine = 'Gemini 2.0 Flash Direct';
    } catch (gErr) {
      console.log('Gemini API lỗi:', gErr.message);
    }
  }

  // BƯỚC 3: Fallback Heuristic
  if (!reviewData) {
    reviewData = generateFallbackSecurityReview(diffText, language);
    processingEngine = 'Security Static Heuristics Engine';
  }

  // Chuẩn hóa danh sách issues
  if (reviewData.issues) {
    reviewData.issues.forEach((iss, idx) => {
      iss.id = iss.id || `iss_${Date.now()}_${idx}`;
      iss.accepted = iss.accepted !== undefined ? iss.accepted : true;
    });
  }

  const newReview = {
    id: 'rev_' + Date.now(),
    repoId: repoId || 'repo_default',
    pullNumber: pullNumber || Math.floor(Math.random() * 50 + 1),
    pullTitle: pullTitle || 'Pull Request: Cập nhật mã nguồn & tính năng',
    author: req.user ? req.user.fullName : 'Developer',
    status: reviewData.qualityScore >= (config.minQualityScore || 80) ? 'APPROVED' : 'CHANGES_REQUESTED',
    qualityScore: reviewData.qualityScore || 80,
    grade: reviewData.grade || 'B',
    summary: reviewData.summary || 'Đã hoàn tất rà soát chất lượng code',
    diffText,
    issues: reviewData.issues || [],
    engine: processingEngine,
    createdAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString()
  };

  db.reviews.unshift(newReview);
  writeDB(db);

  res.json({
    success: true,
    message: `Đã phân tích code thành công qua ${processingEngine}!`,
    engine: processingEngine,
    review: newReview
  });
});

// 5. Lấy danh sách reviews của Repo
router.get('/reviews/:repoId', verifyToken, (req, res) => {
  const { repoId } = req.params;
  const db = readDB();
  const list = db.reviews.filter(r => r.repoId === repoId);
  res.json({ success: true, reviews: list });
});

// 6. Chỉnh sửa & Chốt duyệt nhận xét (Human-in-the-loop - Thành viên 2)
router.put('/reviews/:reviewId/toggle-issue', verifyToken, (req, res) => {
  const { reviewId } = req.params;
  const { issueId } = req.body;

  const db = readDB();
  const review = db.reviews.find(r => r.id === reviewId);
  if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy review' });

  const issue = (review.issues || []).find(i => i.id === issueId);
  if (issue) {
    issue.accepted = !issue.accepted;
    writeDB(db);
    return res.json({ success: true, issue, message: `Đã ${issue.accepted ? 'chấp nhận' : 'bỏ qua'} nhận xét này` });
  }

  res.status(404).json({ success: false, message: 'Không tìm thấy nhận xét' });
});

// 6. Chốt duyệt trạng thái Pull Request (Approve / Reject)
router.put('/reviews/:reviewId/status', verifyToken, (req, res) => {
  const { reviewId } = req.params;
  const { status } = req.body; // 'APPROVED' or 'CHANGES_REQUESTED'

  const db = readDB();
  const review = db.reviews.find(r => r.id === reviewId);
  if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy review' });

  review.status = status;
  review.updatedAt = new Date().toISOString();
  writeDB(db);

  res.json({ success: true, review, message: `Đã chốt duyệt trạng thái: ${status}` });
});

module.exports = router;
