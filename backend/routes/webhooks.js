const express = require('express');
const { readDB, writeDB } = require('../storage');

const router = express.Router();

// 9. Luồng Đồng bộ trạng thái ngược từ Jira Webhook (Thành viên 3)
// Lắng nghe khi developer kéo task sang Done trên Jira
router.post('/jira-sync', (req, res) => {
  const payload = req.body || {};
  const issueKey = payload.issue ? payload.issue.key : payload.issueKey;
  const newStatus = (payload.issue && payload.issue.fields && payload.issue.fields.status)
    ? payload.issue.fields.status.name
    : (payload.status || 'Done');

  if (!issueKey) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin issueKey từ Webhook' });
  }

  const db = readDB();
  let updated = false;

  // Tìm kiếm task hoặc story có jiraKey khớp để cập nhật trạng thái
  db.requirements.forEach(reqItem => {
    if (reqItem.epics) {
      reqItem.epics.forEach(epic => {
        if (epic.jiraKey === issueKey) {
          epic.status = newStatus;
          updated = true;
        }
        if (epic.stories) {
          epic.stories.forEach(story => {
            if (story.jiraKey === issueKey) {
              story.status = newStatus;
              updated = true;
            }
            if (story.tasks) {
              story.tasks.forEach(task => {
                if (task.jiraKey === issueKey) {
                  task.status = newStatus;
                  updated = true;
                }
              });
            }
          });
        }
      });
    }
  });

  const logItem = {
    id: 'log_' + Date.now(),
    issueKey,
    oldStatus: payload.oldStatus || 'In Progress',
    newStatus,
    event: payload.webhookEvent || 'jira:issue_updated',
    timestamp: new Date().toISOString()
  };

  db.syncLogs.unshift(logItem);
  if (db.syncLogs.length > 50) db.syncLogs.pop(); // Giữ tối đa 50 logs gần nhất

  writeDB(db);

  console.log(`[Jira Webhook Sync] Đã nhận sự kiện đồng bộ: Issue ${issueKey} chuyển trạng thái thành "${newStatus}"`);

  res.json({
    success: true,
    message: `Đã đồng bộ trạng thái Issue ${issueKey} thành "${newStatus}"`,
    updatedInDatabase: updated,
    log: logItem
  });
});

// Giả lập sự kiện Jira Webhook để kiểm thử và chấm bài trực quan
router.post('/simulate-jira-event', (req, res) => {
  const { issueKey, status, oldStatus } = req.body;
  const targetKey = issueKey || 'ECOM-103';
  const targetStatus = status || 'Done';

  const db = readDB();
  let found = false;

  db.requirements.forEach(reqItem => {
    if (reqItem.epics) {
      reqItem.epics.forEach(epic => {
        if (epic.jiraKey === targetKey) { epic.status = targetStatus; found = true; }
        if (epic.stories) {
          epic.stories.forEach(st => {
            if (st.jiraKey === targetKey) { st.status = targetStatus; found = true; }
            if (st.tasks) {
              st.tasks.forEach(t => {
                if (t.jiraKey === targetKey) { t.status = targetStatus; found = true; }
              });
            }
          });
        }
      });
    }
  });

  const logItem = {
    id: 'sim_' + Date.now(),
    issueKey: targetKey,
    oldStatus: oldStatus || 'In Progress',
    newStatus: targetStatus,
    event: 'jira:issue_updated (Simulated Event)',
    timestamp: new Date().toISOString()
  };

  db.syncLogs.unshift(logItem);
  writeDB(db);

  res.json({
    success: true,
    message: `Đã giả lập thành công Jira Webhook: ${targetKey} chuyển sang "${targetStatus}"!`,
    foundInDb: found,
    log: logItem
  });
});

// Lấy danh sách lịch sử đồng bộ webhook
router.get('/sync-logs', (req, res) => {
  const db = readDB();
  res.json({ success: true, logs: db.syncLogs || [] });
});

module.exports = router;
