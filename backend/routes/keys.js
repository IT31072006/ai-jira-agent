const express = require('express');
const axios = require('axios');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// 3. Lấy cấu hình Vault của Repo (Thành viên 1)
router.get('/:repoId', verifyToken, (req, res) => {
  const { repoId } = req.params;
  const db = readDB();
  const config = db.apiConfigs[repoId] || {
    githubToken: '',
    geminiKey: '',
    minQualityScore: 80,
    blockOnCritical: true,
    discordWebhookUrl: '',
    n8nReviewWebhookUrl: 'http://localhost:5678/webhook/review-code-diff',
    n8nCommentWebhookUrl: 'http://localhost:5678/webhook/comment-github-pr',
    n8nTestGenWebhookUrl: 'http://localhost:5678/webhook/generate-unit-tests'
  };

  const masked = {
    ...config,
    githubTokenMasked: config.githubToken ? (config.githubToken.slice(0, 6) + '...' + config.githubToken.slice(-4)) : '',
    geminiKeyMasked: config.geminiKey ? (config.geminiKey.slice(0, 6) + '...' + config.geminiKey.slice(-4)) : '',
    hasGithubToken: !!config.githubToken,
    hasGeminiKey: !!config.geminiKey
  };

  res.json({ success: true, config: masked });
});

// 3. Lưu cấu hình Vault (Thành viên 1)
router.post('/:repoId', verifyToken, (req, res) => {
  const { repoId } = req.params;
  const {
    githubToken,
    geminiKey,
    minQualityScore,
    blockOnCritical,
    discordWebhookUrl,
    n8nReviewWebhookUrl,
    n8nCommentWebhookUrl,
    n8nTestGenWebhookUrl
  } = req.body;

  const db = readDB();
  const current = db.apiConfigs[repoId] || {};

  const updated = {
    githubToken: githubToken ? githubToken.trim() : current.githubToken,
    geminiKey: geminiKey ? geminiKey.trim() : current.geminiKey,
    minQualityScore: minQualityScore !== undefined ? parseInt(minQualityScore) : (current.minQualityScore || 80),
    blockOnCritical: blockOnCritical !== undefined ? blockOnCritical : (current.blockOnCritical ?? true),
    discordWebhookUrl: discordWebhookUrl !== undefined ? discordWebhookUrl.trim() : current.discordWebhookUrl,
    n8nReviewWebhookUrl: n8nReviewWebhookUrl !== undefined ? n8nReviewWebhookUrl.trim() : current.n8nReviewWebhookUrl,
    n8nCommentWebhookUrl: n8nCommentWebhookUrl !== undefined ? n8nCommentWebhookUrl.trim() : current.n8nCommentWebhookUrl,
    n8nTestGenWebhookUrl: n8nTestGenWebhookUrl !== undefined ? n8nTestGenWebhookUrl.trim() : current.n8nTestGenWebhookUrl
  };

  db.apiConfigs[repoId] = updated;

  // Đồng bộ sang thông tin repo
  const repo = db.repositories.find(r => r.id === repoId);
  if (repo) {
    repo.minQualityScore = updated.minQualityScore;
    repo.blockOnCritical = updated.blockOnCritical;
  }

  writeDB(db);

  res.json({
    success: true,
    message: 'Đã lưu cấu hình API Keys & Quality Gate Policy thành công',
    hasGithubToken: !!updated.githubToken,
    hasGeminiKey: !!updated.geminiKey
  });
});

// 3. Kiểm tra kết nối GitHub qua Personal Access Token
router.post('/:repoId/test-github', verifyToken, async (req, res) => {
  const { repoId } = req.params;
  const db = readDB();
  const config = db.apiConfigs[repoId];
  const token = req.body.githubToken || (config && config.githubToken);

  if (!token) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập GitHub Personal Access Token' });
  }

  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Reviewer'
      },
      timeout: 8000
    });

    res.json({
      success: true,
      message: `Kết nối GitHub thành công! Tài khoản: ${response.data.login} (${response.data.name || 'Developer'})`,
      githubUser: response.data.login
    });
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
    res.status(400).json({ success: false, message: `Không thể kết nối GitHub: ${msg}` });
  }
});

// 3. Kiểm tra kết nối Gemini AI
router.post('/:repoId/test-gemini', verifyToken, async (req, res) => {
  const { repoId } = req.params;
  const db = readDB();
  const config = db.apiConfigs[repoId];
  const apiKey = req.body.geminiKey || (config && config.geminiKey) || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Gemini API Key' });
  }

  try {
    await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: 'Respond with {"status": "ok"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      },
      { timeout: 8000 }
    );
    res.json({ success: true, message: 'Kết nối Google Gemini 2.0 Flash AI thành công!' });
  } catch (err) {
    res.status(400).json({ success: false, message: `Lỗi kết nối Gemini: ${err.message}` });
  }
});

module.exports = router;
