const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initStorage } = require('./storage');
const { router: authRouter } = require('./routes/auth');
const workspacesRouter = require('./routes/workspaces');
const keysRouter = require('./routes/keys');
const aiRouter = require('./routes/ai');
const jiraRouter = require('./routes/jira');
const webhooksRouter = require('./routes/webhooks');
const statsRouter = require('./routes/stats');
const exportRouter = require('./routes/export');

const app = express();

// Khởi tạo thư mục và dữ liệu database ban đầu
initStorage();

// Middleware
app.use(cors());
app.use(express.json());

// Routes gắn theo 12 luồng cho 4 thành viên
app.use('/api/auth', authRouter);              // Thành viên 1: Luồng 1 (JWT Auth)
app.use('/api/workspaces', workspacesRouter);  // Thành viên 1: Luồng 2 (Workspace CRUD)
app.use('/api/keys', keysRouter);              // Thành viên 1: Luồng 3 (API Key Vault)

app.use('/api/ai', aiRouter);                  // Thành viên 2: Luồng 4, 5, 6 (Core AI & Edit)

app.use('/api/jira', jiraRouter);              // Thành viên 3: Luồng 7 (Push Jira), Luồng 8 (Members)
app.use('/api/webhooks', webhooksRouter);      // Thành viên 3: Luồng 9 (Jira Webhook Sync)

app.use('/api/stats', statsRouter);            // Thành viên 4: Luồng 10 (Dashboard Stats)
app.use('/api/export', exportRouter);          // Thành viên 4: Luồng 11 (Notify), Luồng 12 (Export)

// Endpoint kiểm tra trạng thái Backend
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'AI Requirement-to-Jira Agent Backend',
    timestamp: new Date().toISOString(),
    supportedFlows: [
      'Flow 1: JWT Authentication',
      'Flow 2: Workspace Management',
      'Flow 3: API Key Vault (Jira & Gemini)',
      'Flow 4: AI Requirement Breakdown (n8n Webhook / Gemini)',
      'Flow 5: Visual Tree/Table View (Human-in-the-loop)',
      'Flow 6: Edit & Validate Backlog',
      'Flow 7: Push Hierarchy to Jira REST API v3',
      'Flow 8: Jira Member Assignee Search',
      'Flow 9: Jira Webhook Status Sync',
      'Flow 10: Analytics Dashboard',
      'Flow 11: Multi-channel Automated Notification',
      'Flow 12: Technical Document Export (Markdown/PDF)'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AI Requirement-to-Jira Agent Server`);
  console.log(`📡 Backend đang chạy tại: http://localhost:${PORT}`);
  console.log(`🔗 Kiểm tra trạng thái: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});