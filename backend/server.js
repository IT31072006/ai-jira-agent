const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initStorage } = require('./storage');
const { router: authRouter } = require('./routes/auth');
const reposRouter = require('./routes/repos');
const keysRouter = require('./routes/keys');
const aiRouter = require('./routes/ai');
const githubRouter = require('./routes/github');
const webhooksRouter = require('./routes/webhooks');
const statsRouter = require('./routes/stats');
const exportRouter = require('./routes/export');

const app = express();

initStorage();

app.use(cors());
app.use(express.json());

// Gắn 12 luồng tính năng cho 4 thành viên
app.use('/api/auth', authRouter);          // Thành viên 1: Luồng 1 (JWT Auth)
app.use('/api/repos', reposRouter);        // Thành viên 1: Luồng 2 (Repo CRUD)
app.use('/api/keys', keysRouter);          // Thành viên 1: Luồng 3 (API Keys & Quality Gate Policy)

app.use('/api/ai', aiRouter);              // Thành viên 2: Luồng 4, 5, 6 (Core AI Review, Diff View & Approve)

app.use('/api/github', githubRouter);      // Thành viên 3: Luồng 7 (PR Comments), Luồng 8 (Unit Test Gen)
app.use('/api/webhooks', webhooksRouter);  // Thành viên 3: Luồng 9 (GitHub Webhook Sync & Simulator)

app.use('/api/stats', statsRouter);        // Thành viên 4: Luồng 10 (Quality Dashboard & Leaderboard)
app.use('/api/export', exportRouter);      // Thành viên 4: Luồng 11 (Discord Alert), Luồng 12 (Audit Export)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'AI-Powered Code Reviewer & Automated PR Quality Gate',
    topic: '16. Software Engineering Automation',
    timestamp: new Date().toISOString(),
    supportedFlows: [
      'Flow 1: JWT Authentication & User Management (Member 1)',
      'Flow 2: Monitored Repositories Management (Member 1)',
      'Flow 3: API Vault & Quality Gate Policies (Member 1)',
      'Flow 4: Git Diff AI Security Analysis via n8n (Member 2)',
      'Flow 5: Interactive Visual Diff Viewer (Member 2)',
      'Flow 6: Human-in-the-loop Issue Edit & Validation (Member 2)',
      'Flow 7: Automated GitHub PR Review Comments via n8n (Member 3)',
      'Flow 8: Automated Unit Test Generator (Jest/PyTest) (Member 3)',
      'Flow 9: GitHub Webhook Sync & Event Simulator (Member 3)',
      'Flow 10: Code Quality Metrics & Clean Code Leaderboard (Member 4)',
      'Flow 11: Multi-channel Automated Notification (Discord/Slack) (Member 4)',
      'Flow 12: Technical Audit & Security Report Export (Markdown/PDF) (Member 4)'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AI-Powered Code Reviewer & PR Quality Gate Backend`);
  console.log(`📡 Server online tại: http://localhost:${PORT}`);
  console.log(`🔗 Kiểm tra trạng thái: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});