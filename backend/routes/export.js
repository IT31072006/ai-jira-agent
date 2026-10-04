const express = require('express');
const axios = require('axios');
const { readDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// 12. Xuất tài liệu kỹ thuật dạng Markdown (Thành viên 4)
router.get('/markdown/:sessionId', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const db = readDB();
  const session = db.requirements.find(r => r.id === sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiên làm việc' });
  }

  let md = `# TÀI LIỆU PHÂN RÃ NGHIỆP VỤ & TÁC VỤ KỸ THUẬT\n\n`;
  md += `> **Dự án**: ${session.title}\n`;
  md += `> **Thời gian tạo**: ${new Date(session.createdAt).toLocaleString('vi-VN')}\n`;
  md += `> **Trạng thái Jira**: ${session.pushedToJira ? 'ĐÃ ĐẨY LÊN JIRA' : 'BẢN THẢO (DRAFT)'}\n\n`;

  md += `## 1. YÊU CẦU NGHIỆP VỤ GỐC (RAW REQUIREMENT)\n\n`;
  md += `${session.rawText}\n\n`;
  md += `---\n\n`;

  md += `## 2. DANH SÁCH EPIC, USER STORY VÀ SUB-TASKS\n\n`;

  if (session.epics) {
    session.epics.forEach((epic, eIdx) => {
      md += `### Epic ${eIdx + 1}: [${epic.jiraKey || 'NEW'}] ${epic.summary}\n`;
      md += `*Mô tả*: ${epic.description || 'Không có'}\n\n`;

      if (epic.stories && epic.stories.length > 0) {
        epic.stories.forEach((story, sIdx) => {
          md += `#### User Story ${eIdx + 1}.${sIdx + 1}: [${story.jiraKey || 'NEW'}] ${story.summary}\n`;
          md += `- **Mô tả**: ${story.description}\n`;
          md += `- **Story Points**: ${story.storyPoints || 0} | **Độ ưu tiên**: ${story.priority || 'Medium'} | **Trạng thái**: ${story.status || 'To Do'}\n`;
          md += `- **Người phụ trách (Assignee)**: ${story.assignee || 'Chưa gán'}\n`;

          if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
            md += `- **Tiêu chí nghiệm thu (Acceptance Criteria)**:\n`;
            story.acceptanceCriteria.forEach(ac => {
              md += `  - [ ] ${ac}\n`;
            });
          }

          if (story.tasks && story.tasks.length > 0) {
            md += `\n**Sub-tasks Kỹ thuật**:\n`;
            md += `| Mã Jira | Tên công việc | Ước lượng (giờ) | Trạng thái |\n`;
            md += `| :--- | :--- | :---: | :---: |\n`;
            story.tasks.forEach(task => {
              md += `| ${task.jiraKey || 'NEW'} | ${task.summary} | ${task.estimatedHours || 0}h | ${task.status || 'To Do'} |\n`;
            });
          }
          md += `\n`;
        });
      }
      md += `\n`;
    });
  }

  md += `\n---\n*Tài liệu được sinh tự động bởi AI Requirement-to-Jira Agent.*\n`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="requirement_breakdown_${sessionId}.md"`);
  res.send(md);
});

// 11. Bắn thông báo thủ công tới Discord / Slack (Thành viên 4)
router.post('/notify-channel', verifyToken, async (req, res) => {
  const { workspaceId, customMessage } = req.body;
  const db = readDB();
  const config = db.apiConfigs[workspaceId] || {};
  const discordUrl = config.discordWebhookUrl;

  if (!discordUrl) {
    return res.status(400).json({
      success: false,
      message: 'Chưa cấu hình Discord Webhook URL trong mục Cấu hình API Keys!'
    });
  }

  try {
    await axios.post(discordUrl, {
      username: 'AI Jira Agent (Test)',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/5968/5968875.png',
      embeds: [{
        title: '📢 [THÔNG BÁO] Kiểm thử kết nối kênh thông báo tự động',
        color: 5814783,
        description: customMessage || 'Hệ thống AI Requirement-to-Jira Agent đã kết nối thành công tới Discord channel của nhóm!',
        fields: [
          { name: 'Workspace', value: workspaceId, inline: true },
          { name: 'Thời gian gửi', value: new Date().toLocaleString('vi-VN'), inline: true }
        ],
        footer: { text: 'Automated by AI Jira Agent • Flow 11' }
      }]
    });

    res.json({ success: true, message: 'Đã gửi thông báo đến Discord thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi gửi Discord Webhook: ' + err.message });
  }
});

module.exports = router;
