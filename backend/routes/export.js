const express = require('express');
const axios = require('axios');
const { readDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// 12. Xuất Báo cáo Audit & Security Report ra file Markdown (.md) (Thành viên 4)
router.get('/audit-markdown/:reviewId', verifyToken, (req, res) => {
  const { reviewId } = req.params;
  const db = readDB();
  const review = db.reviews.find(r => r.id === reviewId);

  if (!review) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả review' });
  }

  const repo = db.repositories.find(r => r.id === review.repoId) || { fullName: 'repository' };

  let md = `# BÁO CÁO RÀ SOÁT CHẤT LƯỢNG MÃ NGUỒN & BẢO MẬT (CODE AUDIT REPORT)\n\n`;
  md += `> **Dự án / Repo**: ${repo.fullName}\n`;
  md += `> **Pull Request**: #${review.pullNumber} - ${review.pullTitle}\n`;
  md += `> **Tác giả PR**: ${review.author}\n`;
  md += `> **Thời gian rà soát**: ${new Date(review.reviewedAt || review.createdAt).toLocaleString('vi-VN')}\n`;
  md += `> **Đánh giá tổng thể**: ${review.qualityScore}/100 (Hạng: **${review.grade}**) | Trạng thái: **${review.status}**\n\n`;

  md += `## 1. TỔNG KẾT ĐÁNH GIÁ (EXECUTIVE SUMMARY)\n\n`;
  md += `${review.summary}\n\n`;
  md += `---\n\n`;

  md += `## 2. CHI TIẾT CÁC LỖI & ĐỀ XUẤT KHẮC PHỤC\n\n`;

  if (review.issues && review.issues.length > 0) {
    md += `| Dòng | Mức độ | Phân loại | Tiêu đề & Chi tiết | Đề xuất giải pháp |\n`;
    md += `| :---: | :---: | :---: | :--- | :--- |\n`;
    review.issues.forEach(iss => {
      md += `| L${iss.line || 'N/A'} | **${iss.severity}** | ${iss.type} | ${iss.title || iss.message} | \`${iss.suggestion || 'Xem xét tái cấu trúc'}\` |\n`;
    });
  } else {
    md += `*Không phát hiện lỗi nghiêm trọng. Mã nguồn đạt chuẩn chất lượng Quality Gate.*\n`;
  }

  md += `\n---\n\n`;
  md += `## 3. ĐOẠN MÃ GIT DIFF LIÊN QUAN\n\n`;
  md += `\`\`\`diff\n${review.diffText || 'No diff provided'}\n\`\`\`\n\n`;

  if (review.unitTests) {
    md += `## 4. MÃ KIỂM THỬ UNIT TEST ĐƯỢC SINH TỰ ĐỘNG\n\n`;
    md += `\`\`\`javascript\n${review.unitTests}\n\`\`\`\n\n`;
  }

  md += `\n---\n*Báo cáo được sinh tự động bởi hệ thống AI-Powered Code Reviewer & Automated PR Quality Gate.*\n`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="code_audit_pr_${review.pullNumber}.md"`);
  res.send(md);
});

// 11. Bắn thông báo kết quả review vào Discord / Slack (Thành viên 4)
router.post('/notify-discord', verifyToken, async (req, res) => {
  const { repoId, reviewId } = req.body;
  const db = readDB();
  const repo = db.repositories.find(r => r.id === repoId) || { fullName: 'my-project' };
  const review = db.reviews.find(r => r.id === reviewId);
  const config = db.apiConfigs[repoId] || {};

  const discordUrl = config.discordWebhookUrl;
  if (!discordUrl) {
    return res.status(400).json({ success: false, message: 'Chưa cấu hình Discord Webhook URL trong Cấu hình API Vault!' });
  }

  try {
    const score = review ? review.qualityScore : 85;
    const grade = review ? review.grade : 'B';
    const statusColor = score >= 80 ? 3066993 : (score >= 60 ? 15844367 : 15158332);

    await axios.post(discordUrl, {
      username: 'AI Code Reviewer Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/2111/2111432.png',
      embeds: [{
        title: `⚡ [CODE AUDIT] ${repo.fullName} - PR #${review ? review.pullNumber : '42'}`,
        color: statusColor,
        description: review ? review.summary : 'Báo cáo kiểm thử tự động chất lượng mã nguồn.',
        fields: [
          { name: 'Điểm chất lượng', value: `**${score}/100** (Hạng ${grade})`, inline: true },
          { name: 'Trạng thái Quality Gate', value: review ? review.status : 'PASSED', inline: true },
          { name: 'Số lỗi bảo mật', value: `${(review ? review.issues : []).filter(i => i.severity === 'CRITICAL').length}`, inline: true }
        ],
        footer: { text: 'Automated by AI Code Reviewer • Software Engineering Automation' },
        timestamp: new Date().toISOString()
      }]
    });

    res.json({ success: true, message: 'Đã bắn thông báo review code tới Discord thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi gửi Discord Webhook: ' + err.message });
  }
});

module.exports = router;
