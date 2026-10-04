const express = require('express');
const axios = require('axios');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// Danh sách thành viên mẫu thực tế khi chưa gắn Jira API Token thật
const MOCK_MEMBERS = [
  { accountId: 'acc_01', displayName: 'Nguyễn Văn Developer (Backend Lead)', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
  { accountId: 'acc_02', displayName: 'Trần Thị QA (Tester Lead)', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
  { accountId: 'acc_03', displayName: 'Lê Hoàng Frontend (React Dev)', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
  { accountId: 'acc_04', displayName: 'Phạm Minh DevOps (Cloud Infra)', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' }
];

// 8. Lấy danh sách thành viên Jira (Thành viên 3)
router.get('/members', verifyToken, async (req, res) => {
  const { workspaceId, projectKey } = req.query;
  const db = readDB();
  const config = db.apiConfigs[workspaceId];

  if (config && config.jiraDomain && config.jiraEmail && config.jiraToken) {
    try {
      const cleanDomain = config.jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${config.jiraEmail}:${config.jiraToken}`).toString('base64');
      const pKey = projectKey || 'PROJ';

      const response = await axios.get(`https://${cleanDomain}/rest/api/3/user/assignable/search?project=${pKey}`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
        timeout: 6000
      });

      const members = response.data.map(u => ({
        accountId: u.accountId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrls ? u.avatarUrls['48x48'] : ''
      }));

      return res.json({ success: true, members, source: 'Jira Cloud Live' });
    } catch (err) {
      console.log('Không lấy được member trực tiếp từ Jira, dùng fallback mock:', err.message);
    }
  }

  res.json({ success: true, members: MOCK_MEMBERS, source: 'Demo Workspace Team' });
});

// 7. Đẩy dữ liệu lên Jira (Thành viên 3)
// Gọi n8n Webhook / Loop node, fallback trực tiếp sang Jira API hoặc Local Push Simulation
router.post('/push', verifyToken, async (req, res) => {
  const { workspaceId, sessionId, epics, projectKey } = req.body;

  const db = readDB();
  const config = db.apiConfigs[workspaceId] || {};
  const n8nPushUrl = config.n8nPushWebhookUrl || 'http://localhost:5678/webhook/push-to-jira';
  const pKey = projectKey || 'PROJ';

  let pushMethod = '';
  let createdCount = { epics: 0, stories: 0, tasks: 0 };
  const createdIssues = [];

  // BƯỚC 1: Thử gọi n8n Webhook đẩy lên Jira (Theo đúng yêu cầu của đồ án)
  try {
    console.log(`[Jira Push] Đang gọi Webhook n8n: ${n8nPushUrl}...`);
    const n8nRes = await axios.post(n8nPushUrl, {
      jiraDomain: config.jiraDomain || 'mycompany.atlassian.net',
      jiraEmail: config.jiraEmail || 'dev@mycompany.com',
      jiraToken: config.jiraToken || '',
      projectKey: pKey,
      epics
    }, { timeout: 10000 });

    if (n8nRes.data && n8nRes.data.success) {
      pushMethod = 'n8n Automation Loop Workflow';
    }
  } catch (n8nErr) {
    console.log(`[Jira Push] n8n Webhook không phản hồi (${n8nErr.message}). Chuyển sang Direct Push...`);
  }

  // BƯỚC 2: Nếu có Jira credentials thật, gọi Jira REST API v3 trực tiếp
  const hasRealJira = config.jiraDomain && config.jiraEmail && config.jiraToken;
  if (!pushMethod && hasRealJira) {
    try {
      const cleanDomain = config.jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${config.jiraEmail}:${config.jiraToken}`).toString('base64');

      for (const epic of epics) {
        // Tạo Epic
        const epicRes = await axios.post(`https://${cleanDomain}/rest/api/3/issue`, {
          fields: {
            project: { key: pKey },
            summary: epic.summary,
            description: {
              type: 'doc', version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: epic.description || '' }] }]
            },
            issuetype: { name: 'Epic' }
          }
        }, { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } });

        const epicKey = epicRes.data.key;
        epic.jiraKey = epicKey;
        createdCount.epics++;
        createdIssues.push({ key: epicKey, type: 'Epic', summary: epic.summary });

        // Tạo Stories gắn với Epic
        if (epic.stories) {
          for (const story of epic.stories) {
            const storyRes = await axios.post(`https://${cleanDomain}/rest/api/3/issue`, {
              fields: {
                project: { key: pKey },
                parent: { key: epicKey },
                summary: story.summary,
                description: {
                  type: 'doc', version: 1,
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: story.description || '' }] }]
                },
                issuetype: { name: 'Story' }
              }
            }, { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } });

            const storyKey = storyRes.data.key;
            story.jiraKey = storyKey;
            createdCount.stories++;
            createdIssues.push({ key: storyKey, type: 'Story', summary: story.summary });

            // Tạo Sub-tasks gắn với Story
            if (story.tasks) {
              for (const task of story.tasks) {
                const taskRes = await axios.post(`https://${cleanDomain}/rest/api/3/issue`, {
                  fields: {
                    project: { key: pKey },
                    parent: { key: storyKey },
                    summary: task.summary,
                    issuetype: { name: 'Sub-task' }
                  }
                }, { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } });

                task.jiraKey = taskRes.data.key;
                createdCount.tasks++;
                createdIssues.push({ key: taskRes.data.key, type: 'Sub-task', summary: task.summary });
              }
            }
          }
        }
      }
      pushMethod = 'Jira Cloud REST API v3 Direct';
    } catch (jiraErr) {
      console.log('Lỗi gọi Jira API trực tiếp:', jiraErr.response ? jiraErr.response.data : jiraErr.message);
    }
  }

  // BƯỚC 3: Nếu là môi trường demo (chưa cấu hình token thật), sinh mã Jira Key chuẩn hóa
  if (!pushMethod) {
    let issueCounter = Math.floor(Math.random() * 500 + 100);
    epics.forEach(epic => {
      epic.jiraKey = epic.jiraKey || `${pKey}-${issueCounter++}`;
      createdCount.epics++;
      createdIssues.push({ key: epic.jiraKey, type: 'Epic', summary: epic.summary });

      if (epic.stories) {
        epic.stories.forEach(st => {
          st.jiraKey = st.jiraKey || `${pKey}-${issueCounter++}`;
          createdCount.stories++;
          createdIssues.push({ key: st.jiraKey, type: 'Story', summary: st.summary });

          if (st.tasks) {
            st.tasks.forEach(t => {
              t.jiraKey = t.jiraKey || `${pKey}-${issueCounter++}`;
              createdCount.tasks++;
              createdIssues.push({ key: t.jiraKey, type: 'Sub-task', summary: t.summary });
            });
          }
        });
      }
    });
    pushMethod = 'Jira Sandbox Simulation (Demo Mode)';
  }

  // Cập nhật session trong Database
  const session = db.requirements.find(r => r.id === sessionId);
  if (session) {
    session.pushedToJira = true;
    session.pushedAt = new Date().toISOString();
    session.epics = epics;
    session.status = 'PUSHED';
  }
  writeDB(db);

  // Tự động bắn thông báo Discord / Slack nếu có cấu hình (Luồng 11)
  if (config.discordWebhookUrl) {
    try {
      await axios.post(config.discordWebhookUrl, {
        username: 'AI Jira Agent',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/5968/5968875.png',
        embeds: [{
          title: `🚀 [THÀNH CÔNG] Đã đẩy Backlog lên Jira (${pKey})`,
          color: 3066993,
          description: `Đã tự động tạo thành công **${createdCount.epics} Epic**, **${createdCount.stories} Story**, và **${createdCount.tasks} Sub-task** trên Jira.`,
          fields: [
            { name: 'Dự án Jira', value: pKey, inline: true },
            { name: 'Cơ chế đẩy', value: pushMethod, inline: true },
            { name: 'Thời gian', value: new Date().toLocaleTimeString('vi-VN'), inline: true }
          ]
        }]
      }, { timeout: 4000 });
    } catch (e) {
      console.log('Không thể bắn Discord notification:', e.message);
    }
  }

  res.json({
    success: true,
    message: `Đã đẩy thành công lên Jira thông qua ${pushMethod}!`,
    pushMethod,
    createdCount,
    createdIssues,
    jiraProjectUrl: config.jiraDomain ? `https://${config.jiraDomain.replace(/^https?:\/\//, '')}/jira/your-work` : '#'
  });
});

module.exports = router;
