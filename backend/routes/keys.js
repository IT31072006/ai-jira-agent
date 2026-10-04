const express = require('express');
const axios = require('axios');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// Lấy cấu hình keys của workspace (Thành viên 1)
router.get('/:workspaceId', verifyToken, (req, res) => {
  const { workspaceId } = req.params;
  const db = readDB();
  const config = db.apiConfigs[workspaceId] || {
    jiraDomain: '',
    jiraEmail: '',
    jiraToken: '',
    geminiKey: '',
    discordWebhookUrl: '',
    n8nWebhookUrl: 'http://localhost:5678/webhook/analyze-requirement',
    n8nPushWebhookUrl: 'http://localhost:5678/webhook/push-to-jira'
  };

  // Mask token khi trả về frontend để bảo mật
  const maskedConfig = {
    ...config,
    jiraTokenMasked: config.jiraToken ? (config.jiraToken.slice(0, 6) + '...' + config.jiraToken.slice(-4)) : '',
    geminiKeyMasked: config.geminiKey ? (config.geminiKey.slice(0, 6) + '...' + config.geminiKey.slice(-4)) : '',
    hasJiraToken: !!config.jiraToken,
    hasGeminiKey: !!config.geminiKey
  };

  res.json({ success: true, config: maskedConfig });
});

// Lưu cấu hình keys (Thành viên 1)
router.post('/:workspaceId', verifyToken, (req, res) => {
  const { workspaceId } = req.params;
  const { jiraDomain, jiraEmail, jiraToken, geminiKey, discordWebhookUrl, n8nWebhookUrl, n8nPushWebhookUrl } = req.body;

  const db = readDB();
  const current = db.apiConfigs[workspaceId] || {};

  // Nếu người dùng không nhập token mới (để trống khi edit), giữ nguyên token cũ
  const updated = {
    jiraDomain: jiraDomain !== undefined ? jiraDomain.trim() : current.jiraDomain,
    jiraEmail: jiraEmail !== undefined ? jiraEmail.trim() : current.jiraEmail,
    jiraToken: jiraToken ? jiraToken.trim() : current.jiraToken,
    geminiKey: geminiKey ? geminiKey.trim() : current.geminiKey,
    discordWebhookUrl: discordWebhookUrl !== undefined ? discordWebhookUrl.trim() : current.discordWebhookUrl,
    n8nWebhookUrl: n8nWebhookUrl !== undefined ? n8nWebhookUrl.trim() : current.n8nWebhookUrl,
    n8nPushWebhookUrl: n8nPushWebhookUrl !== undefined ? n8nPushWebhookUrl.trim() : current.n8nPushWebhookUrl
  };

  db.apiConfigs[workspaceId] = updated;
  writeDB(db);

  res.json({
    success: true,
    message: 'Đã lưu cấu hình API Keys thành công',
    hasJiraToken: !!updated.jiraToken,
    hasGeminiKey: !!updated.geminiKey
  });
});

// Kiểm tra kết nối Jira trực tiếp (Thành viên 1 & 3)
router.post('/:workspaceId/test-jira', verifyToken, async (req, res) => {
  const { workspaceId } = req.params;
  const db = readDB();
  const config = db.apiConfigs[workspaceId];

  const domain = req.body.jiraDomain || (config && config.jiraDomain);
  const email = req.body.jiraEmail || (config && config.jiraEmail);
  const token = req.body.jiraToken || (config && config.jiraToken);

  if (!domain || !email || !token) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng điền đủ Jira Domain, Email và API Token để kiểm tra kết nối'
    });
  }

  // Chuẩn hóa domain
  let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    const authHeader = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
    const response = await axios.get(`https://${cleanDomain}/rest/api/3/myself`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      timeout: 8000
    });

    res.json({
      success: true,
      message: `Kết nối Jira thành công! Đã xác thực người dùng: ${response.data.displayName} (${response.data.emailAddress || email})`,
      jiraUser: {
        displayName: response.data.displayName,
        accountId: response.data.accountId
      }
    });
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
    res.status(400).json({
      success: false,
      message: `Không thể kết nối đến Jira (${cleanDomain}): ${msg}`
    });
  }
});

// Kiểm tra kết nối Gemini AI (Thành viên 1 & 2)
router.post('/:workspaceId/test-gemini', verifyToken, async (req, res) => {
  const { workspaceId } = req.params;
  const db = readDB();
  const config = db.apiConfigs[workspaceId];
  const apiKey = req.body.geminiKey || (config && config.geminiKey) || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập Gemini API Key để kiểm tra'
    });
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: 'Hello, respond with {"status": "ok"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      },
      { timeout: 8000 }
    );

    res.json({
      success: true,
      message: 'Kết nối Google Gemini 2.0 Flash thành công!'
    });
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
    res.status(400).json({
      success: false,
      message: `Lỗi kết nối Gemini API: ${msg}`
    });
  }
});

module.exports = router;
