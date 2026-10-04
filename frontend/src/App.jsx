import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
  BarChart2,
  Key,
  Download,
  Bell,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Code2,
  FolderGit2,
  User,
  LogOut,
  Check,
  X,
  Copy
} from 'lucide-react';
import './index.css';

const API_BASE = 'http://localhost:3000/api';

// Các mẫu Git Diff chứa lỗi bảo mật & clean code thực tế để demo 1-click
const SAMPLE_DIFFS = [
  {
    title: 'SQL Injection & Rò rỉ mật khẩu (Node.js)',
    diffText: `diff --git a/src/controllers/authController.js b/src/controllers/authController.js
index 7b89a1c..e4f5a2b 100644
--- a/src/controllers/authController.js
+++ b/src/controllers/authController.js
@@ -10,7 +10,12 @@ exports.login = async (req, res) => {
+  const { username, password } = req.body;
+  // LỖ HỔNG: Nối chuỗi trực tiếp cho phép tấn công SQL Injection
+  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
+  const user = await db.query(query);
+  console.log("Raw user password:", password);
+  const token = jwt.sign({ id: user.id }, "secret_key_123", { expiresIn: 3600000 });
+  return res.json({ token });
 }`
  },
  {
    title: 'XSS & Cookie không an toàn (Express.js)',
    diffText: `diff --git a/src/routes/profile.js b/src/routes/profile.js
index 4a12c3b..8d90e2f 100644
--- a/src/routes/profile.js
+++ b/src/routes/profile.js
@@ -15,6 +15,10 @@ router.get('/user-bio', (req, res) => {
+  const userBio = req.query.bio;
+  // LỖ HỔNG XSS: Render trực tiếp HTML từ input người dùng
+  res.send("<div><h1>User Bio:</h1><p>" + userBio + "</p></div>");
+  res.cookie("sessionId", "abc123456", { httpOnly: false, secure: false });
 });`
  },
  {
    title: 'Hardcoded AWS Secret & Memory Leak (Python/JS)',
    diffText: `diff --git a/src/services/storage.js b/src/services/storage.js
index 11ab22c..33cd44e 100644
--- a/src/services/storage.js
+++ b/src/services/storage.js
@@ -5,6 +5,10 @@ const uploadFile = async (file) => {
+  const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
+  const AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
+  const bufferCache = [];
+  setInterval(() => bufferCache.push(file), 100);
+  return s3.upload({ file, key: AWS_ACCESS_KEY });
 };`
  }
];

export default function App() {
  // Navigation Tabs: 6 Tabs cho 12 Luồng
  const [activeTab, setActiveTab] = useState('review'); // 'review', 'testgen', 'github', 'dashboard', 'keys', 'export'
  const [toast, setToast] = useState(null);

  // Auth State (Thành viên 1 - Luồng 1)
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: 'lead-dev@aicodereviewer.com', password: 'password123', fullName: 'Nguyễn Văn Tech Lead' });

  // Repository State (Thành viên 1 - Luồng 2)
  const [repositories, setRepositories] = useState([]);
  const [activeRepoId, setActiveRepoId] = useState('');
  const [showNewRepoModal, setShowNewRepoModal] = useState(false);
  const [newRepoForm, setNewRepoForm] = useState({ owner: 'quan-tech', name: 'payment-microservice', defaultBranch: 'main', language: 'JavaScript / Node.js' });

  // Keys & Quality Gate State (Thành viên 1 - Luồng 3)
  const [keysConfig, setKeysConfig] = useState({
    githubToken: '',
    geminiKey: '',
    minQualityScore: 80,
    blockOnCritical: true,
    discordWebhookUrl: '',
    n8nReviewWebhookUrl: 'http://localhost:5678/webhook/review-code-diff',
    n8nCommentWebhookUrl: 'http://localhost:5678/webhook/comment-github-pr',
    n8nTestGenWebhookUrl: 'http://localhost:5678/webhook/generate-unit-tests'
  });
  const [testingGithub, setTestingGithub] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);

  // Core AI Review State (Thành viên 2 - Luồng 4, 5, 6)
  const [diffInput, setDiffInput] = useState(SAMPLE_DIFFS[0].diffText);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [reviewsList, setReviewsList] = useState([]);

  // Automated Unit Test State (Thành viên 3 - Luồng 8)
  const [generatedTest, setGeneratedTest] = useState(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  // GitHub & Webhook State (Thành viên 3 - Luồng 7, 9)
  const [isCommentingPR, setIsCommentingPR] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [simulatingHook, setSimulatingHook] = useState(false);

  // Dashboard Stats State (Thành viên 4 - Luồng 10)
  const [dashboardStats, setDashboardStats] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getHeaders = () => {
    const currentToken = token || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    return headers;
  };

  // Helper fetch an toàn: Tự động phục hồi phiên nếu token bị hết hạn hoặc không khớp secret cũ
  const apiFetch = async (endpoint, options = {}) => {
    let currentToken = token || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

    try {
      let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      let data = await res.json();

      if (res.status === 401 || res.status === 403 || (data && data.message && data.message.includes('Token'))) {
        console.log('[Auth] Token không hợp lệ hoặc đã hết hạn, tự động khôi phục phiên đăng nhập demo...');
        const autoRes = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'lead-dev@aicodereviewer.com', password: 'password123' })
        });
        const autoData = await autoRes.json();
        if (autoData.success) {
          localStorage.setItem('token', autoData.token);
          localStorage.setItem('user', JSON.stringify(autoData.user));
          setToken(autoData.token);
          setUser(autoData.user);
          headers['Authorization'] = `Bearer ${autoData.token}`;

          // Tự động retry gọi lại API ban đầu
          res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
          data = await res.json();
        }
      }
      return data;
    } catch (err) {
      console.error('Lỗi apiFetch:', err);
      return { success: false, message: err.message };
    }
  };

  // Khởi động tải dữ liệu
  useEffect(() => {
    if (token) {
      loadRepositories();
      loadSyncLogs();
    }
  }, [token]);

  useEffect(() => {
    if (activeRepoId) {
      loadKeysConfig(activeRepoId);
      loadReviews(activeRepoId);
      loadDashboardStats(activeRepoId);
    }
  }, [activeRepoId]);

  // ===================== AUTH API (Thành viên 1 - Luồng 1) =====================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setShowAuthModal(false);
      showToast(`Chào mừng, ${data.user.fullName}!`, 'success');
      if (data.activeRepoId) setActiveRepoId(data.activeRepoId);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setShowAuthModal(true);
  };

  // ===================== REPOSITORIES API (Thành viên 1 - Luồng 2) =====================
  const loadRepositories = async () => {
    try {
      const res = await fetch(`${API_BASE}/repos`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.repositories.length > 0) {
        setRepositories(data.repositories);
        if (!activeRepoId) setActiveRepoId(data.repositories[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRepo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/repos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newRepoForm)
      });
      const data = await res.json();
      if (data.success) {
        setRepositories([...repositories, data.repository]);
        setActiveRepoId(data.repository.id);
        setShowNewRepoModal(false);
        showToast('Đã thêm Repository vào hệ thống giám sát!', 'success');
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // ===================== API KEYS & QUALITY GATE (Thành viên 1 - Luồng 3) =====================
  const loadKeysConfig = async (repoId) => {
    try {
      const res = await fetch(`${API_BASE}/keys/${repoId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setKeysConfig(data.config);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveKeys = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/keys/${activeRepoId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(keysConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã lưu cấu hình API Keys & Quality Gate!', 'success');
        loadKeysConfig(activeRepoId);
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleTestGithub = async () => {
    setTestingGithub(true);
    try {
      const res = await fetch(`${API_BASE}/keys/${activeRepoId}/test-github`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(keysConfig)
      });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
    } catch (err) {
      showToast('Lỗi kiểm tra kết nối GitHub', 'danger');
    } finally {
      setTestingGithub(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    try {
      const res = await fetch(`${API_BASE}/keys/${activeRepoId}/test-gemini`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(keysConfig)
      });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
    } catch (err) {
      showToast('Lỗi kiểm tra Gemini', 'danger');
    } finally {
      setTestingGemini(false);
    }
  };

  // ===================== CORE AI REVIEW (Thành viên 2 - Luồng 4, 5, 6) =====================
  const loadReviews = async (repoId) => {
    try {
      const res = await fetch(`${API_BASE}/ai/reviews/${repoId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.reviews.length > 0) {
        setReviewsList(data.reviews);
        if (!currentReview) setCurrentReview(data.reviews[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewDiff = async () => {
    if (!diffInput.trim()) return showToast('Vui lòng nhập đoạn Git Diff cần review', 'danger');
    setIsReviewing(true);
    try {
      const data = await apiFetch('/ai/review-diff', {
        method: 'POST',
        body: JSON.stringify({
          repoId: activeRepoId,
          pullNumber: Math.floor(Math.random() * 80 + 10),
          pullTitle: 'PR: Thắt chặt bảo mật API & tối ưu mã nguồn',
          diffText: diffInput,
          language: 'javascript'
        })
      });
      if (data && data.success) {
        setCurrentReview(data.review);
        setReviewsList([data.review, ...reviewsList]);
        showToast(`Review hoàn tất! Điểm: ${data.review.qualityScore}/100 [${data.engine}]`, 'success');
        loadDashboardStats(activeRepoId);
      } else {
        showToast((data && data.message) || 'Lỗi phân tích review', 'danger');
      }
    } catch (err) {
      showToast('Lỗi gọi API Review AI', 'danger');
    } finally {
      setIsReviewing(false);
    }
  };

  // Toggle Accept / Dismiss Issue (Luồng 6 - Human in the loop)
  const handleToggleIssue = async (issueId) => {
    if (!currentReview) return;
    try {
      const res = await fetch(`${API_BASE}/ai/reviews/${currentReview.id}/toggle-issue`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ issueId })
      });
      const data = await res.json();
      if (data.success) {
        const updatedIssues = currentReview.issues.map(i => i.id === issueId ? { ...i, accepted: data.issue.accepted } : i);
        setCurrentReview({ ...currentReview, issues: updatedIssues });
        showToast(data.message, 'info');
      }
    } catch (err) {
      showToast('Lỗi cập nhật nhận xét', 'danger');
    }
  };

  // Chốt duyệt PR (Luồng 6)
  const handleUpdateStatus = async (status) => {
    if (!currentReview) return;
    try {
      const res = await fetch(`${API_BASE}/ai/reviews/${currentReview.id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentReview({ ...currentReview, status });
        showToast(data.message, 'success');
        loadDashboardStats(activeRepoId);
      }
    } catch (err) {
      showToast('Lỗi chốt duyệt', 'danger');
    }
  };

  // ===================== GITHUB PR & UNIT TEST (Thành viên 3 - Luồng 7, 8, 9) =====================
  const handleCommentOnGitHub = async () => {
    if (!currentReview) return showToast('Chưa có review để gửi', 'danger');
    setIsCommentingPR(true);
    try {
      const res = await fetch(`${API_BASE}/github/comment-pr`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ repoId: activeRepoId, reviewId: currentReview.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setCurrentReview({ ...currentReview, commentedOnGitHub: true });
      } else {
        showToast(data.message, 'danger');
      }
    } catch (err) {
      showToast('Lỗi gửi comment lên GitHub', 'danger');
    } finally {
      setIsCommentingPR(false);
    }
  };

  const handleGenerateUnitTests = async () => {
    setIsGeneratingTest(true);
    try {
      const res = await fetch(`${API_BASE}/github/generate-unit-tests`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          repoId: activeRepoId,
          codeSnippet: diffInput,
          language: 'javascript',
          functionName: 'login'
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedTest(data.data);
        showToast(data.message, 'success');
      }
    } catch (err) {
      showToast('Lỗi sinh Unit Test', 'danger');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/webhooks/sync-logs`);
      const data = await res.json();
      if (data.success) setSyncLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateWebhook = async () => {
    setSimulatingHook(true);
    try {
      const res = await fetch(`${API_BASE}/webhooks/simulate-pr-opened`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pullNumber: Math.floor(Math.random() * 60 + 10) })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        loadSyncLogs();
        loadReviews(activeRepoId);
        if (data.review) setCurrentReview(data.review);
      }
    } catch (err) {
      showToast('Lỗi giả lập Webhook', 'danger');
    } finally {
      setSimulatingHook(false);
    }
  };

  // ===================== DASHBOARD & EXPORT (Thành viên 4 - Luồng 10, 11, 12) =====================
  const loadDashboardStats = async (repoId) => {
    try {
      const res = await fetch(`${API_BASE}/stats/quality-dashboard?repoId=${repoId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setDashboardStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!currentReview) return showToast('Chưa có review để xuất', 'danger');
    window.open(`${API_BASE}/export/audit-markdown/${currentReview.id}?token=${token}`, '_blank');
  };

  const handleNotifyDiscord = async () => {
    if (!currentReview) return;
    try {
      const res = await fetch(`${API_BASE}/export/notify-discord`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ repoId: activeRepoId, reviewId: currentReview.id })
      });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
    } catch (err) {
      showToast('Lỗi gửi thông báo Discord', 'danger');
    }
  };

  // Parse dòng git diff để render visual
  const parseDiffLines = (text) => {
    if (!text) return [];
    return text.split('\n').map((line, idx) => {
      let type = 'normal';
      if (line.startsWith('+') && !line.startsWith('+++')) type = 'addition';
      else if (line.startsWith('-') && !line.startsWith('---')) type = 'deletion';
      return { lineNum: idx + 1, content: line, type };
    });
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div className="toast-container">
          <div className="toast" style={{ borderLeftColor: toast.type === 'danger' ? '#f43f5e' : toast.type === 'success' ? '#10b981' : '#3b82f6' }}>
            {toast.type === 'success' ? <CheckCircle2 size={18} color="#10b981" /> : <AlertTriangle size={18} color="#f43f5e" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header className="top-nav">
        <div className="nav-brand">
          <div className="brand-icon">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="brand-title">AI Code Reviewer & PR Quality Gate</span>
              <span className="brand-tag">Topic 16 • Automation</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Automated Code Security, Unit Test Generator & GitHub Webhook Sync
            </div>
          </div>
        </div>

        {/* REPOSITORY SELECTOR (Thành viên 1 - Luồng 2) */}
        <div className="repo-selector-wrapper">
          <FolderGit2 size={16} color="var(--primary)" />
          <select
            className="repo-select"
            value={activeRepoId}
            onChange={(e) => setActiveRepoId(e.target.value)}
          >
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName} ({r.defaultBranch})
              </option>
            ))}
          </select>
          <button
            className="btn-icon"
            style={{ width: '26px', height: '26px' }}
            title="Thêm Repository mới"
            onClick={() => setShowNewRepoModal(true)}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* 6 TABS NAVIGATION CHO 12 LUỒNG */}
        <nav className="nav-tabs">
          <button className={`nav-tab-btn ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
            <Sparkles size={15} /> 1. Review & Diff
          </button>
          <button className={`nav-tab-btn ${activeTab === 'testgen' ? 'active' : ''}`} onClick={() => setActiveTab('testgen')}>
            <Code2 size={15} /> 2. Sinh Unit Test
          </button>
          <button className={`nav-tab-btn ${activeTab === 'github' ? 'active' : ''}`} onClick={() => setActiveTab('github')}>
            <GitPullRequest size={15} /> 3. GitHub & Webhook
          </button>
          <button className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <BarChart2 size={15} /> 4. Dashboard
          </button>
          <button className={`nav-tab-btn ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
            <Key size={15} /> 5. API Vault & Rules
          </button>
          <button className={`nav-tab-btn ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>
            <Download size={15} /> 6. Xuất Báo cáo
          </button>
        </nav>

        {/* USER PROFILE */}
        <div className="nav-actions">
          {user ? (
            <div className="user-badge">
              <div className="user-avatar-circle">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <span>{user.fullName}</span>
              <button className="btn-icon" style={{ width: '26px', height: '26px', border: 'none' }} onClick={handleLogout} title="Đăng xuất">
                <LogOut size={14} color="#f43f5e" />
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
              <User size={16} /> Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="main-content">

        {/* ========================================================================= */}
        {/* TAB 1: REVIEW CODE & GIT DIFF (Luồng 4, 5, 6 - Thành viên 2) */}
        {/* ========================================================================= */}
        {activeTab === 'review' && (
          <div>
            {/* Input Diff Box */}
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🔍 Rà soát Git Diff & Phát hiện Lỗ hổng Bảo mật</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Dán đoạn git diff hoặc chọn mẫu thử để n8n Webhook gọi Gemini AI phân tích lỗ hổng bảo mật, lỗi cú pháp và code smell.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Mẫu thử lỗi:</span>
                  {SAMPLE_DIFFS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setDiffInput(s.diffText)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                className="form-textarea"
                rows={5}
                value={diffInput}
                onChange={(e) => setDiffInput(e.target.value)}
                placeholder="Dán đoạn Git Diff tại đây..."
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '1rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {diffInput.length} ký tự • Tương thích n8n Webhook & GitHub Pull Request Diff
                </span>

                <button className="btn-primary" onClick={handleReviewDiff} disabled={isReviewing} style={{ minWidth: '200px' }}>
                  {isReviewing ? <><div className="spinner" /> Đang rà soát...</> : <><Sparkles size={16} /> Bắt đầu AI Review (n8n)</>}
                </button>
              </div>
            </div>

            {/* REVIEW RESULT & QUALITY SCORE (Luồng 5) */}
            {currentReview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Score & Summary Banner */}
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', borderLeft: `6px solid ${currentReview.qualityScore >= 80 ? '#10b981' : '#f43f5e'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div
                      className="score-badge-circle"
                      style={{
                        borderColor: currentReview.qualityScore >= 80 ? '#10b981' : (currentReview.qualityScore >= 60 ? '#f59e0b' : '#f43f5e'),
                        color: currentReview.qualityScore >= 80 ? '#34d399' : (currentReview.qualityScore >= 60 ? '#fbbf24' : '#fb7185')
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{currentReview.qualityScore}</span>
                      <span style={{ fontSize: '0.65rem' }}>HẠNG {currentReview.grade}</span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                          PR #{currentReview.pullNumber}: {currentReview.pullTitle}
                        </h3>
                        <span className={`badge ${currentReview.status === 'APPROVED' ? 'badge-clean' : 'badge-critical'}`}>
                          {currentReview.status}
                        </span>
                        <span className="badge badge-suggestion" style={{ fontFamily: 'var(--font-mono)' }}>
                          {currentReview.engine}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {currentReview.summary}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Luồng 6: Human-in-the-loop Approve) */}
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn-success" onClick={() => handleUpdateStatus('APPROVED')}>
                      <Check size={16} /> Phê duyệt (Approve)
                    </button>
                    <button className="btn-secondary" style={{ color: '#fb7185' }} onClick={() => handleUpdateStatus('CHANGES_REQUESTED')}>
                      <X size={16} /> Yêu cầu sửa (Request Changes)
                    </button>
                    <button className="btn-primary" onClick={handleCommentOnGitHub} disabled={isCommentingPR}>
                      {isCommentingPR ? <div className="spinner" /> : <ExternalLink size={16} />} Gửi lên GitHub PR
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE DIFF VIEWER (Luồng 5 & 6) */}
                <div className="glass-card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                      📑 Trực quan hóa Git Diff & AI Review Comments
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {(currentReview.issues || []).length} vấn đề được ghim vào từng dòng code
                    </span>
                  </div>

                  <div className="diff-container">
                    <div className="diff-header-bar">
                      <span>diff --git a/src/controllers/authController.js</span>
                      <span>Unified Diff Viewer</span>
                    </div>

                    {parseDiffLines(currentReview.diffText).map((line, idx) => {
                      // Tìm issue có line khớp
                      const issueOnLine = (currentReview.issues || []).find(i => i.line === line.lineNum || (idx === 3 && i.severity === 'CRITICAL'));
                      return (
                        <React.Fragment key={idx}>
                          <div className={`diff-line ${line.type}`}>
                            <div className="diff-line-number">{line.lineNum}</div>
                            <div className="diff-line-content">{line.content}</div>
                          </div>

                          {/* Ghim nhận xét AI ngay dưới dòng code vi phạm */}
                          {issueOnLine && (
                            <div
                              className="ai-comment-card"
                              style={{
                                borderLeftColor: issueOnLine.severity === 'CRITICAL' ? '#f43f5e' : (issueOnLine.severity === 'WARNING' ? '#f59e0b' : '#3b82f6'),
                                opacity: issueOnLine.accepted ? 1 : 0.5
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span className={`badge ${issueOnLine.severity === 'CRITICAL' ? 'badge-critical' : (issueOnLine.severity === 'WARNING' ? 'badge-warning' : 'badge-suggestion')}`}>
                                    {issueOnLine.severity}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{issueOnLine.title}</span>
                                </div>

                                <button
                                  className="btn-secondary"
                                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                  onClick={() => handleToggleIssue(issueOnLine.id)}
                                >
                                  {issueOnLine.accepted ? 'Bỏ qua (Dismiss)' : 'Chấp nhận (Accept)'}
                                </button>
                              </div>

                              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                {issueOnLine.message}
                              </p>

                              {issueOnLine.suggestion && (
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                                  💡 <strong>Đề xuất sửa:</strong> {issueOnLine.suggestion}
                                </div>
                              )}
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: AUTOMATED UNIT TEST GENERATOR (Luồng 8 - Thành viên 3) */}
        {/* ========================================================================= */}
        {activeTab === 'testgen' && (
          <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              🧪 Tự động Sinh Mã Kiểm thử Unit Test (Jest / PyTest)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              AI tự động phân tích các hàm trong Pull Request và sinh ra bộ kiểm thử Unit Test bao phủ 100% các trường hợp (Positive, Negative, Boundary).
            </p>

            <button className="btn-primary" onClick={handleGenerateUnitTests} disabled={isGeneratingTest} style={{ marginBottom: '1.25rem' }}>
              {isGeneratingTest ? <><div className="spinner" /> Đang sinh Unit Test...</> : <><Sparkles size={16} /> Sinh Unit Test Tự Động (n8n)</>}
            </button>

            {generatedTest && (
              <div style={{ background: 'var(--bg-code)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem', background: '#161b22', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  <span>Framework: <strong>{generatedTest.framework}</strong> • {generatedTest.testCasesCount} Test Cases</span>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(generatedTest.testCode);
                      showToast('Đã sao chép mã Unit Test vào Clipboard!', 'success');
                    }}
                  >
                    <Copy size={12} /> Sao chép Code
                  </button>
                </div>
                <pre style={{ padding: '1rem', color: '#93c5fd', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', overflowX: 'auto', lineHeight: '1.5' }}>
                  {generatedTest.testCode}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: GITHUB INTEGRATION & WEBHOOK SYNC (Luồng 7, 9 - Thành viên 3) */}
        {/* ========================================================================= */}
        {activeTab === 'github' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    🐙 Tự động hóa Tương tác GitHub Pull Request (n8n Webhook)
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Endpoint <code>POST /api/webhooks/github</code> tự động lắng nghe khi dev mở PR trên GitHub để kích hoạt review ngầm.
                  </p>
                </div>

                <button className="btn-primary" onClick={handleSimulateWebhook} disabled={simulatingHook}>
                  <RefreshCw size={14} className={simulatingHook ? 'spinner' : ''} />
                  Bắn giả lập GitHub Webhook (PR Opened)
                </button>
              </div>

              {/* Webhook Sync Logs */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Sự kiện Webhook</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Kho lưu trữ</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Số PR</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Hành động tự động</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 600 }}>
                          {log.event}
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-primary)' }}>{log.repo}</td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700 }}>#{log.pullNumber}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>
                          <span className="badge badge-clean">{log.actionTaken}</span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: QUALITY DASHBOARD & LEADERBOARD (Luồng 10 - Thành viên 4) */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && dashboardStats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="metric-grid">
              <div className="metric-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <span className="metric-card-title">Tổng số lượt PR đã Review</span>
                <span className="metric-card-value">{dashboardStats.totalReviews}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid #10b981' }}>
                <span className="metric-card-title">Điểm Chất Lượng Trung Bình</span>
                <span className="metric-card-value">{dashboardStats.avgScore}/100</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid #f43f5e' }}>
                <span className="metric-card-title">Lỗ hổng Bảo Mật (Critical)</span>
                <span className="metric-card-value">{dashboardStats.issueBreakdown.criticalSecurity}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <span className="metric-card-title">Tỷ lệ Đạt Quality Gate</span>
                <span className="metric-card-value">{dashboardStats.passRate}%</span>
              </div>
            </div>

            {/* Clean Code Leaderboard */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                🏆 Bảng Xếp Hạng Lập Trình Viên Viết Code Sạch Nhất (Clean Code Leaderboard)
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Hạng</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Lập trình viên</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Số PR đã mở</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Điểm Code TB</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Số lỗi bảo mật mắc phải</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardStats.leaderboard || []).map((dev, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 800 }}>#{idx + 1}</td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{dev.name}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>{dev.prsCount} PRs</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>
                          <span className={`badge ${dev.avgScore >= 80 ? 'badge-clean' : 'badge-warning'}`}>
                            {dev.avgScore} pts
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', color: dev.criticals > 0 ? '#fb7185' : '#34d399', fontWeight: 700 }}>
                          {dev.criticals} lỗi
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: API KEYS VAULT & QUALITY POLICIES (Luồng 3 - Thành viên 1) */}
        {/* ========================================================================= */}
        {activeTab === 'keys' && (
          <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              🔑 Cấu hình Khóa Bảo mật & Ngưỡng duyệt Quality Gate
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Cấu hình các điều kiện chặn Merge và kết nối GitHub / Gemini AI cho kho lưu trữ đang chọn.
            </p>

            <form onSubmit={handleSaveKeys}>
              <div className="form-group">
                <label className="form-label">
                  GitHub Personal Access Token (PAT): {keysConfig.githubTokenMasked && <span style={{ color: '#34d399' }}>({keysConfig.githubTokenMasked})</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={keysConfig.githubToken || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, githubToken: e.target.value })}
                  placeholder="ghp_xxxxxxxxxxxx"
                />
                <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', marginTop: '0.4rem', fontSize: '0.75rem' }} onClick={handleTestGithub} disabled={testingGithub}>
                  {testingGithub ? <div className="spinner" /> : <FolderGit2 size={14} />} Kiểm tra kết nối GitHub
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Google Gemini API Key: {keysConfig.geminiKeyMasked && <span style={{ color: '#34d399' }}>({keysConfig.geminiKeyMasked})</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={keysConfig.geminiKey || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, geminiKey: e.target.value })}
                  placeholder="AIzaSy..."
                />
                <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', marginTop: '0.4rem', fontSize: '0.75rem' }} onClick={handleTestGemini} disabled={testingGemini}>
                  {testingGemini ? <div className="spinner" /> : <Sparkles size={14} />} Kiểm tra kết nối Gemini AI
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Điểm duyệt tối thiểu (Quality Score Threshold):</label>
                  <input
                    type="number"
                    className="form-input"
                    value={keysConfig.minQualityScore || 80}
                    onChange={(e) => setKeysConfig({ ...keysConfig, minQualityScore: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Chặn merge nếu có Critical Vulnerability:</label>
                  <select
                    className="form-input"
                    value={keysConfig.blockOnCritical ? 'true' : 'false'}
                    onChange={(e) => setKeysConfig({ ...keysConfig, blockOnCritical: e.target.value === 'true' })}
                  >
                    <option value="true">BẬT (Khuyên dùng cho Security)</option>
                    <option value="false">TẮT (Cảnh báo nhưng cho merge)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Discord Webhook URL (Bắn thông báo tự động):</label>
                <input
                  type="text"
                  className="form-input"
                  value={keysConfig.discordWebhookUrl || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, discordWebhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="submit" className="btn-primary">
                  <Check size={16} /> Lưu Cấu Hình Quality Gate
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: XUẤT BÁO CÁO & THÔNG BÁO (Luồng 11, 12 - Thành viên 4) */}
        {/* ========================================================================= */}
        {activeTab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '0 auto' }}>
            <div className="glass-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📄 Xuất Báo cáo Audit & Security Report
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Tải về toàn bộ hồ sơ phân tích an toàn thông tin và đánh giá chất lượng mã nguồn theo định dạng Markdown hoặc in PDF phục vụ nghiệm thu đồ án.
              </p>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" onClick={handleDownloadMarkdown}>
                  <Download size={16} /> Tải Báo cáo Markdown (.md)
                </button>
                <button className="btn-secondary" onClick={() => window.print()}>
                  🖨️ In ấn / Lưu định dạng PDF
                </button>
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📢 Bắn Thông báo Review tới Discord / Slack (Luồng 11)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Gửi thẻ kết quả chấm điểm và cảnh báo bảo mật trực tiếp vào kênh chat của team.
              </p>

              <button className="btn-secondary" onClick={handleNotifyDiscord}>
                <Bell size={16} color="var(--primary)" /> Bắn tin nhắn Rich Card tới Discord
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* AUTH MODAL (Thành viên 1 - Luồng 1) */}
      {/* ========================================================================= */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#131927', border: '1px solid var(--border-subtle)', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              {authMode === 'login' ? 'Đăng nhập Hệ thống Code Reviewer' : 'Đăng ký Tài khoản mới'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Xác thực JWT Token bảo mật đa tầng qua Express.js (Luồng 1)
            </p>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Họ và tên:</label>
                    <input
                      type="text"
                      className="form-input"
                      value={authForm.fullName}
                      onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                      placeholder="vd: Lê Hoàng Quân"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vai trò trong nhóm:</label>
                    <select
                      className="form-input"
                      value={authForm.role || 'Software Engineer'}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    >
                      <option value="Tech Lead / Reviewer">Tech Lead / Reviewer</option>
                      <option value="Senior Developer">Senior Developer</option>
                      <option value="Junior Developer">Junior Developer</option>
                      <option value="Security Specialist">Security Specialist</option>
                      <option value="QA Automation Engineer">QA Automation Engineer</option>
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Email tài khoản:</label>
                <input
                  type="email"
                  className="form-input"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu:</label>
                <input
                  type="password"
                  className="form-input"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {authMode === 'login' ? 'Đăng nhập ngay' : 'Tạo tài khoản mới'}
              </button>

              {/* Danh sách tài khoản mẫu để chuyển đổi nhanh */}
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                  ⚡ Tài khoản mẫu có sẵn (Bấm để đăng nhập ngay):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', justifyContent: 'space-between' }}
                    onClick={() => {
                      setAuthForm({ email: 'lead-dev@aicodereviewer.com', password: 'password123', fullName: 'Nguyễn Văn Tech Lead', role: 'Tech Lead / Reviewer' });
                      fetch(`${API_BASE}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'lead-dev@aicodereviewer.com', password: 'password123' })
                      }).then(r => r.json()).then(data => {
                        if (data.success) {
                          localStorage.setItem('token', data.token);
                          localStorage.setItem('user', JSON.stringify(data.user));
                          setToken(data.token);
                          setUser(data.user);
                          setShowAuthModal(false);
                          showToast(`Đăng nhập thành công: ${data.user.fullName} (${data.user.role})!`, 'success');
                          if (data.activeRepoId) setActiveRepoId(data.activeRepoId);
                        }
                      });
                    }}
                  >
                    <span>👨‍💻 <strong>Nguyễn Văn Tech Lead</strong> (lead-dev@aicodereviewer.com)</span>
                    <span style={{ color: '#34d399', fontSize: '0.7rem' }}>Chọn</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', justifyContent: 'space-between' }}
                    onClick={() => {
                      setAuthForm({ email: 'quantech@student.edu.vn', password: 'mysecretpassword', fullName: 'Lê Hoàng Quân', role: 'Security Lead' });
                      fetch(`${API_BASE}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'quantech@student.edu.vn', password: 'mysecretpassword' })
                      }).then(r => r.json()).then(data => {
                        if (data.success) {
                          localStorage.setItem('token', data.token);
                          localStorage.setItem('user', JSON.stringify(data.user));
                          setToken(data.token);
                          setUser(data.user);
                          setShowAuthModal(false);
                          showToast(`Đăng nhập thành công: ${data.user.fullName} (${data.user.role})!`, 'success');
                          if (data.activeRepoId) setActiveRepoId(data.activeRepoId);
                        }
                      });
                    }}
                  >
                    <span>🛡️ <strong>Lê Hoàng Quân</strong> (quantech@student.edu.vn)</span>
                    <span style={{ color: '#34d399', fontSize: '0.7rem' }}>Chọn</span>
                  </button>
                </div>
              </div>
            </form>

            <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <>Chưa có tài khoản? <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setAuthMode('register'); setAuthForm({ email: '', password: '', fullName: '', role: 'Junior Developer' }); }}>Đăng ký tài khoản mới</span></>
              ) : (
                <>Đã có tài khoản? <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setAuthMode('login'); setAuthForm({ email: 'lead-dev@aicodereviewer.com', password: 'password123', fullName: '' }); }}>Quay lại Đăng nhập</span></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW REPO MODAL (Thành viên 1 - Luồng 2) */}
      {/* ========================================================================= */}
      {showNewRepoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#131927', border: '1px solid var(--border-subtle)', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Thêm Repository GitHub Cần Giám Sát
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Hệ thống sẽ tự động quét lỗ hổng bảo mật mỗi khi có Pull Request mới.
            </p>

            <form onSubmit={handleCreateRepo}>
              <div className="form-group">
                <label className="form-label">Tổ chức / Owner (vd: facebook, quan-tech):</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRepoForm.owner}
                  onChange={(e) => setNewRepoForm({ ...newRepoForm, owner: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tên Repository (vd: react, payment-service):</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRepoForm.name}
                  onChange={(e) => setNewRepoForm({ ...newRepoForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nhánh mặc định (Branch):</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRepoForm.defaultBranch}
                  onChange={(e) => setNewRepoForm({ ...newRepoForm, defaultBranch: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowNewRepoModal(false)}>Hủy</button>
                <button type="submit" className="btn-primary">Thêm Repository</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
