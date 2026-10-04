import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Send,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  RefreshCw,
  BarChart3,
  Key,
  Download,
  Bell,
  ChevronDown,
  ChevronRight,
  Shield,
  User,
  LogOut,
  FolderKanban,
  Check,
  AlertCircle
} from 'lucide-react';
import './index.css';

const API_BASE = 'http://localhost:3000/api';

// Mẫu yêu cầu nghiệp vụ thực tế có sẵn để demo nhanh
const SAMPLE_TEMPLATES = [
  {
    title: 'Thanh toán VNPay & MoMo',
    text: 'Xây dựng module thanh toán trực tuyến cho website bán lẻ. Khách hàng có thể quét mã QR qua VNPay hoặc chuyển hướng sang ứng dụng MoMo. Hệ thống cần bảo mật chữ ký HMAC-SHA512, cập nhật trạng thái đơn hàng khi nhận IPN webhook và gửi email biên lai thanh toán.'
  },
  {
    title: 'Hệ thống Quản lý Chấm công AI',
    text: 'Xây dựng tính năng điểm danh nhận diện khuôn mặt cho nhân viên qua camera điện thoại. Tự động tính toán giờ làm, đi muộn, về sớm và tổng hợp bảng công cuối tháng. Cho phép nhân viên gửi đơn xin nghỉ phép và quản lý phê duyệt trực tiếp trên app.'
  },
  {
    title: 'Phân quyền RBAC & Bảo mật 2FA',
    text: 'Xây dựng hệ thống phân quyền người dùng theo vai trò (Super Admin, Manager, Member). Bắt buộc xác thực hai bước (2FA qua OTP Google Authenticator) khi đăng nhập vào bảng điều khiển tài chính và lưu nhật ký hoạt động kiểm toán (Audit Logs).'
  }
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('breakdown'); // 'breakdown', 'jira', 'dashboard', 'keys', 'export'
  const [toast, setToast] = useState(null);

  // Auth State (Thành viên 1)
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ email: 'demo@jira-agent.ai', password: 'password123', fullName: 'Nguyễn Văn Quản Trị' });

  // Workspace State (Thành viên 1)
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceForm, setNewWorkspaceForm] = useState({ name: '', description: '', defaultJiraProjectKey: 'ECOM' });

  // API Keys Vault State (Thành viên 1)
  const [keysConfig, setKeysConfig] = useState({
    jiraDomain: '',
    jiraEmail: '',
    jiraToken: '',
    geminiKey: '',
    discordWebhookUrl: '',
    n8nWebhookUrl: 'http://localhost:5678/webhook/analyze-requirement',
    n8nPushWebhookUrl: 'http://localhost:5678/webhook/push-to-jira'
  });
  const [testingJira, setTestingJira] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);

  // Core AI State (Thành viên 2)
  const [requirementText, setRequirementText] = useState(SAMPLE_TEMPLATES[0].text);
  const [projectKey, setProjectKey] = useState('ECOM');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [epics, setEpics] = useState([]);
  const [collapsedEpics, setCollapsedEpics] = useState({});
  const [collapsedStories, setCollapsedStories] = useState({});

  // Jira Integration State (Thành viên 3)
  const [jiraMembers, setJiraMembers] = useState([]);
  const [isPushingJira, setIsPushingJira] = useState(false);
  const [pushProgress, setPushProgress] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [simulatingSync, setSimulatingSync] = useState(false);

  // Dashboard Stats State (Thành viên 4)
  const [stats, setStats] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Khởi tạo và tải dữ liệu khi có token
  useEffect(() => {
    if (token) {
      loadWorkspaces();
      loadSyncLogs();
    }
  }, [token]);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadKeysConfig(activeWorkspaceId);
      loadSessions(activeWorkspaceId);
      loadDashboardStats(activeWorkspaceId);
      loadJiraMembers(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  // ===================== AUTH API (Thành viên 1) =====================
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
      showToast(`Xin chào, ${data.user.fullName}!`, 'success');

      if (data.activeWorkspaceId) setActiveWorkspaceId(data.activeWorkspaceId);
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

  // ===================== WORKSPACE API (Thành viên 1) =====================
  const loadWorkspaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/workspaces`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.workspaces.length > 0) {
        setWorkspaces(data.workspaces);
        if (!activeWorkspaceId) {
          setActiveWorkspaceId(data.workspaces[0].id);
          setProjectKey(data.workspaces[0].defaultJiraProjectKey || 'ECOM');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newWorkspaceForm)
      });
      const data = await res.json();
      if (data.success) {
        setWorkspaces([...workspaces, data.workspace]);
        setActiveWorkspaceId(data.workspace.id);
        setShowNewWorkspaceModal(false);
        setNewWorkspaceForm({ name: '', description: '', defaultJiraProjectKey: 'PROJ' });
        showToast('Tạo Workspace mới thành công!', 'success');
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // ===================== API KEYS VAULT (Thành viên 1) =====================
  const loadKeysConfig = async (wsId) => {
    try {
      const res = await fetch(`${API_BASE}/keys/${wsId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setKeysConfig(data.config);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveKeys = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/keys/${activeWorkspaceId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(keysConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã lưu cấu hình API Keys an toàn!', 'success');
        loadKeysConfig(activeWorkspaceId);
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleTestJira = async () => {
    setTestingJira(true);
    try {
      const res = await fetch(`${API_BASE}/keys/${activeWorkspaceId}/test-jira`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(keysConfig)
      });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
    } catch (err) {
      showToast('Lỗi kiểm tra kết nối Jira', 'danger');
    } finally {
      setTestingJira(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    try {
      const res = await fetch(`${API_BASE}/keys/${activeWorkspaceId}/test-gemini`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(keysConfig)
      });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
    } catch (err) {
      showToast('Lỗi kiểm tra kết nối Gemini', 'danger');
    } finally {
      setTestingGemini(false);
    }
  };

  // ===================== AI BREAKDOWN API (Thành viên 2) =====================
  const loadSessions = async (wsId) => {
    try {
      const res = await fetch(`${API_BASE}/ai/sessions/${wsId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.sessions.length > 0) {
        setActiveSession(data.sessions[0]);
        setEpics(data.sessions[0].epics || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeRequirement = async () => {
    if (!requirementText.trim()) {
      return showToast('Vui lòng nhập đoạn mô tả yêu cầu nghiệp vụ', 'danger');
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/ai/analyze`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          requirementText,
          projectKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(data.session);
        setEpics(data.data.epics || []);
        showToast(`Đã bóc tách thành công qua [${data.engine}]!`, 'success');
        loadDashboardStats(activeWorkspaceId);
      } else {
        showToast(data.message, 'danger');
      }
    } catch (err) {
      showToast('Lỗi gọi API phân tích AI', 'danger');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ===================== HUMAN-IN-THE-LOOP EDIT (Thành viên 2) =====================
  const handleUpdateEpicTitle = (epicIndex, newSummary) => {
    const updated = [...epics];
    updated[epicIndex].summary = newSummary;
    setEpics(updated);
  };

  const handleUpdateStory = (epicIndex, storyIndex, field, value) => {
    const updated = [...epics];
    updated[epicIndex].stories[storyIndex][field] = value;
    setEpics(updated);
  };

  const handleAddStory = (epicIndex) => {
    const updated = [...epics];
    const newStory = {
      id: `story_${Date.now()}`,
      summary: 'User Story mới (Bấm để đổi tên)',
      description: 'As a user, I want new functionality so that I can achieve my goal.',
      storyPoints: 3,
      priority: 'Medium',
      status: 'To Do',
      assignee: 'Chưa gán',
      acceptanceCriteria: ['Tiêu chí nghiệm thu 1'],
      tasks: [{ id: `task_${Date.now()}`, summary: 'Xây dựng module kỹ thuật', estimatedHours: 3, status: 'To Do' }]
    };
    updated[epicIndex].stories.push(newStory);
    setEpics(updated);
    showToast('Đã thêm Story mới', 'info');
  };

  const handleDeleteStory = (epicIndex, storyIndex) => {
    const updated = [...epics];
    updated[epicIndex].stories.splice(storyIndex, 1);
    setEpics(updated);
  };

  const handleAddTask = (epicIndex, storyIndex) => {
    const updated = [...epics];
    updated[epicIndex].stories[storyIndex].tasks.push({
      id: `task_${Date.now()}`,
      summary: 'Task kỹ thuật mới',
      estimatedHours: 2,
      status: 'To Do'
    });
    setEpics(updated);
  };

  const handleDeleteTask = (epicIndex, storyIndex, taskIndex) => {
    const updated = [...epics];
    updated[epicIndex].stories[storyIndex].tasks.splice(taskIndex, 1);
    setEpics(updated);
  };

  const handleRegenerateStory = async (epicIndex, storyIndex) => {
    const story = epics[epicIndex].stories[storyIndex];
    try {
      showToast('Đang tái tạo Story bằng AI...', 'info');
      const res = await fetch(`${API_BASE}/ai/regenerate-story`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          epicSummary: epics[epicIndex].summary,
          currentStorySummary: story.summary
        })
      });
      const data = await res.json();
      if (data.success && data.story) {
        const updated = [...epics];
        updated[epicIndex].stories[storyIndex] = {
          ...updated[epicIndex].stories[storyIndex],
          summary: data.story.summary,
          description: data.story.description,
          acceptanceCriteria: data.story.acceptanceCriteria || [],
          storyPoints: data.story.storyPoints || 3,
          priority: data.story.priority || 'High'
        };
        setEpics(updated);
        showToast('Đã tái tạo Story chuẩn Agile!', 'success');
      }
    } catch (err) {
      showToast('Không thể tái tạo Story', 'danger');
    }
  };

  const handleSaveEdits = async () => {
    if (!activeSession) return;
    try {
      const res = await fetch(`${API_BASE}/ai/sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ epics })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã lưu tất cả thay đổi vào Database!', 'success');
        loadDashboardStats(activeWorkspaceId);
      }
    } catch (err) {
      showToast('Lỗi lưu thay đổi', 'danger');
    }
  };

  // ===================== JIRA INTEGRATION (Thành viên 3) =====================
  const loadJiraMembers = async (wsId) => {
    try {
      const res = await fetch(`${API_BASE}/jira/members?workspaceId=${wsId}&projectKey=${projectKey}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setJiraMembers(data.members || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePushToJira = async () => {
    if (epics.length === 0) {
      return showToast('Chưa có cấu trúc Epic/Story nào để đẩy lên Jira', 'danger');
    }
    setIsPushingJira(true);
    setPushProgress({ step: 1, message: 'Đang kết nối Webhook n8n / Jira Cloud REST API v3...' });

    try {
      const res = await fetch(`${API_BASE}/jira/push`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          sessionId: activeSession ? activeSession.id : null,
          epics,
          projectKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setPushProgress({
          step: 4,
          message: data.message,
          createdIssues: data.createdIssues,
          jiraUrl: data.jiraProjectUrl,
          method: data.pushMethod
        });
        showToast('Đã đẩy thành công lên Jira!', 'success');
        loadDashboardStats(activeWorkspaceId);
        loadSessions(activeWorkspaceId);
      } else {
        showToast(data.message, 'danger');
        setPushProgress(null);
      }
    } catch (err) {
      showToast('Lỗi đẩy dữ liệu lên Jira', 'danger');
      setPushProgress(null);
    } finally {
      setIsPushingJira(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/webhooks/sync-logs`);
      const data = await res.json();
      if (data.success) {
        setSyncLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateJiraWebhook = async (issueKey = 'ECOM-103') => {
    setSimulatingSync(true);
    try {
      const res = await fetch(`${API_BASE}/webhooks/simulate-jira-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey, status: 'Done', oldStatus: 'In Progress' })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        loadSyncLogs();
        loadSessions(activeWorkspaceId);
        loadDashboardStats(activeWorkspaceId);
      }
    } catch (err) {
      showToast('Lỗi giả lập Webhook', 'danger');
    } finally {
      setSimulatingSync(false);
    }
  };

  // ===================== DASHBOARD STATS (Thành viên 4) =====================
  const loadDashboardStats = async (wsId) => {
    try {
      const res = await fetch(`${API_BASE}/stats/dashboard?workspaceId=${wsId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!activeSession) return showToast('Chưa có phiên làm việc để xuất', 'danger');
    window.open(`${API_BASE}/export/markdown/${activeSession.id}?token=${token}`, '_blank');
  };

  const handleTestDiscordNotify = async () => {
    try {
      const res = await fetch(`${API_BASE}/export/notify-channel`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          customMessage: 'Kiểm thử thông báo tự động từ AI Jira Agent sang Discord channel!'
        })
      });
      const data = await res.json();
      showToast(data.message, data.success ? 'success' : 'danger');
    } catch (err) {
      showToast('Lỗi gửi thông báo', 'danger');
    }
  };

  // Tính tổng số lượng hiển thị nhanh
  const totalStoriesCount = epics.reduce((acc, e) => acc + (e.stories ? e.stories.length : 0), 0);
  const totalTasksCount = epics.reduce((acc, e) => acc + (e.stories ? e.stories.reduce((tAcc, s) => tAcc + (s.tasks ? s.tasks.length : 0), 0) : 0), 0);
  const totalStoryPoints = epics.reduce((acc, e) => acc + (e.stories ? e.stories.reduce((pAcc, s) => pAcc + (parseInt(s.storyPoints) || 0), 0) : 0), 0);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className="toast" style={{ borderLeftColor: toast.type === 'danger' ? '#f43f5e' : toast.type === 'success' ? '#10b981' : '#6366f1' }}>
            {toast.type === 'success' ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#f43f5e" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header className="top-nav">
        <div className="nav-brand">
          <div className="brand-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="brand-title">AI Requirement-to-Jira Agent</span>
              <span className="brand-tag">v2.0 • n8n Powered</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Enterprise Agile Backlog & Task Tracker Automation
            </div>
          </div>
        </div>

        {/* WORKSPACE PICKER (Thành viên 1) */}
        <div className="workspace-selector-wrapper">
          <FolderKanban size={16} color="var(--primary)" />
          <select
            className="workspace-select"
            value={activeWorkspaceId}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.defaultJiraProjectKey || 'PROJ'})
              </option>
            ))}
          </select>
          <button
            className="btn-icon"
            style={{ width: '26px', height: '26px' }}
            title="Tạo Workspace mới"
            onClick={() => setShowNewWorkspaceModal(true)}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* NAVIGATION TABS (12 LUỒNG) */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('breakdown')}
          >
            <Sparkles size={16} />
            <span>1. Bóc tách AI & Sửa cây</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'jira' ? 'active' : ''}`}
            onClick={() => setActiveTab('jira')}
          >
            <ExternalLink size={16} />
            <span>2. Đẩy Jira & Webhook</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={16} />
            <span>3. Dashboard Thống kê</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <Key size={16} />
            <span>4. Cấu hình API Vault</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={16} />
            <span>5. Xuất Tài liệu</span>
          </button>
        </nav>

        {/* USER PROFILE & AUTH (Thành viên 1) */}
        <div className="nav-actions">
          {user ? (
            <div className="user-badge">
              <div className="user-avatar-circle">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <span>{user.fullName}</span>
              <button
                className="btn-icon"
                style={{ width: '28px', height: '28px', border: 'none' }}
                title="Đăng xuất"
                onClick={handleLogout}
              >
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

      {/* MAIN CONTENT AREA */}
      <main className="main-content">

        {/* ========================================================================= */}
        {/* TAB 1: PHÂN TÍCH YÊU CẦU & CÂY HIERARCHY (Luồng 4, 5, 6 - Thành viên 2) */}
        {/* ========================================================================= */}
        {activeTab === 'breakdown' && (
          <div>
            {/* Input Box */}
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>⚡ Phân tích Yêu cầu Nghiệp vụ bằng AI</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Nhập tài liệu nghiệp vụ (BRD/PRD). Express sẽ gửi webhook sang n8n $\rightarrow$ Gemini AI bóc tách cấu trúc Epic, Story và Task.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mã dự án Jira:</span>
                  <input
                    type="text"
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                    style={{
                      width: '80px',
                      padding: '0.35rem 0.6rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'white',
                      fontWeight: 700,
                      textAlign: 'center'
                    }}
                  />
                </div>
              </div>

              {/* Sample Template Chips */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Mẫu nhanh:</span>
                {SAMPLE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                    onClick={() => setRequirementText(tmpl.text)}
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>

              <textarea
                className="form-textarea"
                rows={4}
                value={requirementText}
                onChange={(e) => setRequirementText(e.target.value)}
                placeholder="Nhập yêu cầu nghiệp vụ phần mềm tại đây..."
                style={{ width: '100%', marginBottom: '1rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {requirementText.length} ký tự • Tương thích n8n Webhook & Google Gemini
                </div>

                <button
                  className="btn-primary"
                  onClick={handleAnalyzeRequirement}
                  disabled={isAnalyzing}
                  style={{ minWidth: '180px' }}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="spinner" /> Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Bóc tách bằng AI (n8n)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SUMMARY STATS BAR */}
            <div className="metric-grid">
              <div className="metric-card" style={{ borderLeft: '4px solid var(--epic-color)' }}>
                <span className="metric-card-title">Tổng số Epics</span>
                <span className="metric-card-value">{epics.length}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid var(--story-color)' }}>
                <span className="metric-card-title">User Stories</span>
                <span className="metric-card-value">{totalStoriesCount}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid var(--task-color)' }}>
                <span className="metric-card-title">Sub-tasks Kỹ thuật</span>
                <span className="metric-card-value">{totalTasksCount}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                <span className="metric-card-title">Tổng Story Points</span>
                <span className="metric-card-value">{totalStoryPoints} pts</span>
              </div>
            </div>

            {/* ACTION TOOLBAR (HUMAN-IN-THE-LOOP) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  🌳 Cấu trúc Phân cấp (Human-in-the-loop Editor)
                </h3>
                <span className="badge badge-story">Bấm để chỉnh sửa trực tiếp</span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" onClick={handleSaveEdits}>
                  <Check size={16} /> Lưu thay đổi
                </button>
                <button className="btn-success" onClick={handlePushToJira}>
                  <ExternalLink size={16} /> Phê duyệt & Đẩy lên Jira
                </button>
              </div>
            </div>

            {/* HIERARCHICAL TREE CONTAINER */}
            <div className="tree-container">
              {epics.map((epic, eIdx) => {
                const isEpicCollapsed = collapsedEpics[eIdx];
                return (
                  <div key={epic.id || eIdx} className="epic-card">
                    {/* EPIC HEADER */}
                    <div
                      className="epic-header"
                      onClick={() => setCollapsedEpics({ ...collapsedEpics, [eIdx]: !isEpicCollapsed })}
                    >
                      <div className="epic-header-left">
                        {isEpicCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        <span className="badge badge-epic">EPIC</span>
                        <span className="badge badge-epic" style={{ fontFamily: 'var(--font-mono)' }}>
                          {epic.jiraKey || `${projectKey}-EPIC`}
                        </span>
                        <input
                          type="text"
                          className="editable-input"
                          value={epic.summary}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleUpdateEpicTitle(eIdx, e.target.value)}
                          style={{ fontWeight: 700, fontSize: '0.95rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {(epic.stories || []).length} Stories
                        </span>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                          onClick={() => handleAddStory(eIdx)}
                        >
                          <Plus size={14} /> Thêm Story
                        </button>
                      </div>
                    </div>

                    {/* EPIC BODY: USER STORIES */}
                    {!isEpicCollapsed && (
                      <div className="epic-body">
                        {epic.description && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>
                            {epic.description}
                          </div>
                        )}

                        {(epic.stories || []).map((story, sIdx) => {
                          const isStoryCollapsed = collapsedStories[`${eIdx}_${sIdx}`];
                          return (
                            <div key={story.id || sIdx} className="story-card">
                              {/* STORY HEADER */}
                              <div
                                className="story-header"
                                onClick={() => setCollapsedStories({ ...collapsedStories, [`${eIdx}_${sIdx}`]: !isStoryCollapsed })}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                                  {isStoryCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                  <span className="badge badge-story">STORY</span>
                                  <span className="badge badge-story" style={{ fontFamily: 'var(--font-mono)' }}>
                                    {story.jiraKey || `${projectKey}-STORY`}
                                  </span>
                                  <input
                                    type="text"
                                    className="editable-input"
                                    value={story.summary}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateStory(eIdx, sIdx, 'summary', e.target.value)}
                                    style={{ fontWeight: 600, fontSize: '0.9rem' }}
                                  />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} onClick={(e) => e.stopPropagation()}>
                                  {/* Story Points */}
                                  <select
                                    className="workspace-select"
                                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
                                    value={story.storyPoints || 3}
                                    onChange={(e) => handleUpdateStory(eIdx, sIdx, 'storyPoints', parseInt(e.target.value))}
                                  >
                                    {[1, 2, 3, 5, 8, 13].map((pt) => (
                                      <option key={pt} value={pt}>{pt} Points</option>
                                    ))}
                                  </select>

                                  {/* Priority */}
                                  <select
                                    className="workspace-select"
                                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
                                    value={story.priority || 'Medium'}
                                    onChange={(e) => handleUpdateStory(eIdx, sIdx, 'priority', e.target.value)}
                                  >
                                    <option value="Highest">Highest</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                  </select>

                                  {/* Status */}
                                  <span className={`badge badge-status-${story.status === 'Done' ? 'done' : story.status === 'In Progress' ? 'progress' : 'todo'}`}>
                                    {story.status || 'To Do'}
                                  </span>

                                  {/* Regenerate AI Story */}
                                  <button
                                    className="btn-icon"
                                    style={{ width: '28px', height: '28px' }}
                                    title="Tái tạo Story bằng AI"
                                    onClick={() => handleRegenerateStory(eIdx, sIdx)}
                                  >
                                    <Sparkles size={14} color="var(--primary)" />
                                  </button>

                                  {/* Delete Story */}
                                  <button
                                    className="btn-icon"
                                    style={{ width: '28px', height: '28px' }}
                                    title="Xóa Story"
                                    onClick={() => handleDeleteStory(eIdx, sIdx)}
                                  >
                                    <Trash2 size={14} color="#f43f5e" />
                                  </button>
                                </div>
                              </div>

                              {/* STORY BODY: SUB-TASKS & DETAILS */}
                              {!isStoryCollapsed && (
                                <div className="story-body">
                                  {/* Description & Assignee */}
                                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mô tả Story:</label>
                                      <textarea
                                        className="editable-input"
                                        rows={2}
                                        value={story.description || ''}
                                        onChange={(e) => handleUpdateStory(eIdx, sIdx, 'description', e.target.value)}
                                        style={{ fontSize: '0.85rem' }}
                                      />
                                    </div>

                                    {/* Member Assignee Picker (Luồng 8) */}
                                    <div style={{ minWidth: '200px' }}>
                                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gán cho (Assignee):</label>
                                      <select
                                        className="form-input"
                                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', width: '100%' }}
                                        value={story.assignee || ''}
                                        onChange={(e) => handleUpdateStory(eIdx, sIdx, 'assignee', e.target.value)}
                                      >
                                        <option value="">-- Chưa chỉ định --</option>
                                        {jiraMembers.map((m) => (
                                          <option key={m.accountId} value={m.displayName}>
                                            {m.displayName}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Acceptance Criteria */}
                                  {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.85rem', borderRadius: '6px' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        Tiêu chí nghiệm thu (Acceptance Criteria):
                                      </span>
                                      <ul style={{ paddingLeft: '1.25rem', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {story.acceptanceCriteria.map((ac, acIdx) => (
                                          <li key={acIdx}>{ac}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* SUB-TASKS LIST */}
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--task-color)' }}>
                                        Sub-tasks Kỹ thuật ({(story.tasks || []).length})
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                                        onClick={() => handleAddTask(eIdx, sIdx)}
                                      >
                                        <Plus size={12} /> Thêm Sub-task
                                      </button>
                                    </div>

                                    <div className="task-list">
                                      {(story.tasks || []).map((task, tIdx) => (
                                        <div key={task.id || tIdx} className="task-card">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                            <span className="badge badge-task">TASK</span>
                                            <span className="badge badge-task" style={{ fontFamily: 'var(--font-mono)' }}>
                                              {task.jiraKey || `${projectKey}-TASK`}
                                            </span>
                                            <input
                                              type="text"
                                              className="editable-input"
                                              value={task.summary}
                                              onChange={(e) => {
                                                const updated = [...epics];
                                                updated[eIdx].stories[sIdx].tasks[tIdx].summary = e.target.value;
                                                setEpics(updated);
                                              }}
                                              style={{ fontSize: '0.85rem' }}
                                            />
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                              {task.estimatedHours || 3}h
                                            </span>
                                            <span className={`badge badge-status-${task.status === 'Done' ? 'done' : 'todo'}`}>
                                              {task.status || 'To Do'}
                                            </span>
                                            <button
                                              className="btn-icon"
                                              style={{ width: '24px', height: '24px' }}
                                              onClick={() => handleDeleteTask(eIdx, sIdx, tIdx)}
                                            >
                                              <Trash2 size={12} color="#f43f5e" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ĐẨY LÊN JIRA & ĐỒNG BỘ WEBHOOK (Luồng 7, 8, 9 - Thành viên 3) */}
        {/* ========================================================================= */}
        {activeTab === 'jira' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                🚀 Luồng Tích hợp Jira Cloud & Tự động hóa n8n
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Khi bấm xác nhận, n8n đóng vai trò là workflow engine tự động thực hiện vòng lặp tạo Epic $\rightarrow$ Story $\rightarrow$ Sub-task qua Jira REST API v3.
              </p>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  className="btn-success"
                  onClick={handlePushToJira}
                  disabled={isPushingJira}
                  style={{ minWidth: '220px' }}
                >
                  {isPushingJira ? (
                    <>
                      <div className="spinner" /> Đang đẩy lên Jira...
                    </>
                  ) : (
                    <>
                      <ExternalLink size={16} /> Đẩy toàn bộ Backlog lên Jira
                    </>
                  )}
                </button>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Sẽ tạo <strong>{epics.length} Epic</strong>, <strong>{totalStoriesCount} Story</strong>, và <strong>{totalTasksCount} Sub-task</strong> vào Project <code>{projectKey}</code>
                </div>
              </div>

              {/* Progress Panel */}
              {pushProgress && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#34d399', marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={18} /> {pushProgress.message}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Cơ chế: <strong>{pushProgress.method}</strong> • Đã kích hoạt thông báo tự động đa kênh (Discord/Slack).
                  </div>
                  {pushProgress.createdIssues && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      {pushProgress.createdIssues.slice(0, 8).map((issue, idx) => (
                        <span key={idx} className="badge badge-story">
                          {issue.key}: {issue.summary.slice(0, 20)}...
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* JIRA WEBHOOK SYNC SIMULATOR & MONITOR (Luồng 9 - Thành viên 3) */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    ⚡ Lắng nghe Webhook đồng bộ ngược từ Jira (Jira Sync)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Endpoint <code>POST /api/webhooks/jira-sync</code> tự động lắng nghe khi developer chuyển task sang "Done" trên Jira.
                  </p>
                </div>

                <button
                  className="btn-primary"
                  onClick={() => handleSimulateJiraWebhook('ECOM-103')}
                  disabled={simulatingSync}
                >
                  <RefreshCw size={14} className={simulatingSync ? 'spinner' : ''} />
                  Bắn giả lập Webhook (Chuyển Done)
                </button>
              </div>

              {/* Webhook History Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Mã Issue Jira</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Sự kiện Webhook</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Trạng thái mới</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Thời gian nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có sự kiện webhook nào được nhận.
                        </td>
                      </tr>
                    ) : (
                      syncLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--task-color)', fontWeight: 600 }}>
                            {log.issueKey}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-secondary)' }}>
                            {log.event}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem' }}>
                            <span className="badge badge-status-done">
                              {log.newStatus}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DASHBOARD THỐNG KÊ (Luồng 10 - Thành viên 4) */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top KPI Cards */}
            <div className="metric-grid">
              <div className="metric-card" style={{ borderLeft: '4px solid var(--epic-color)' }}>
                <span className="metric-card-title">Tổng Epic đã phân tích</span>
                <span className="metric-card-value">{stats.totalEpics}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid var(--story-color)' }}>
                <span className="metric-card-title">Tổng User Stories</span>
                <span className="metric-card-value">{stats.totalStories}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid var(--task-color)' }}>
                <span className="metric-card-title">Tổng Sub-tasks</span>
                <span className="metric-card-value">{stats.totalTasks}</span>
              </div>
              <div className="metric-card" style={{ borderLeft: '4px solid #10b981' }}>
                <span className="metric-card-title">Tỷ lệ Hoàn thành (Done)</span>
                <span className="metric-card-value">{stats.completionRate}%</span>
              </div>
            </div>

            {/* Custom SVG Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {/* Chart 1: Story Points theo từng Epic */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                  📊 Phân bố Story Points theo từng Epic
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {stats.epicPointsData.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chưa có dữ liệu Epic</div>
                  ) : (
                    stats.epicPointsData.map((e, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600 }}>{e.jiraKey}: {e.epicSummary}</span>
                          <span style={{ color: 'var(--epic-color)', fontWeight: 700 }}>{e.storyPoints} pts</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, (e.storyPoints / (stats.totalStoryPoints || 1)) * 100)}%`,
                              background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chart 2: Trạng thái & Độ ưu tiên */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                  🎯 Trạng thái công việc & Độ ưu tiên
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Theo Trạng thái:</span>
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>To Do:</span>
                        <strong>{stats.statusCount['To Do'] || 0}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>In Progress:</span>
                        <strong style={{ color: '#818cf8' }}>{stats.statusCount['In Progress'] || 0}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>Done:</span>
                        <strong style={{ color: '#34d399' }}>{stats.statusCount['Done'] || 0}</strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Theo Độ ưu tiên:</span>
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#fb7185' }}>High:</span>
                        <strong>{stats.priorityCount['High'] || 0}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#fbbf24' }}>Medium:</span>
                        <strong>{stats.priorityCount['Medium'] || 0}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#38bdf8' }}>Low:</span>
                        <strong>{stats.priorityCount['Low'] || 0}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CẤU HÌNH API KEYS VAULT (Luồng 3 - Thành viên 1) */}
        {/* ========================================================================= */}
        {activeTab === 'keys' && (
          <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              🔑 Cấu hình Khóa Kết nối (API Keys Vault)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Thông tin kết nối Jira Cloud, Google Gemini và n8n Webhook được bảo vệ an toàn cho từng Workspace.
            </p>

            <form onSubmit={handleSaveKeys}>
              {/* Jira Domain */}
              <div className="form-group">
                <label className="form-label">Jira Domain (ví dụ: mycompany.atlassian.net):</label>
                <input
                  type="text"
                  className="form-input"
                  value={keysConfig.jiraDomain || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, jiraDomain: e.target.value })}
                  placeholder="company.atlassian.net"
                />
              </div>

              {/* Jira Email */}
              <div className="form-group">
                <label className="form-label">Jira Email tài khoản Atlassian:</label>
                <input
                  type="email"
                  className="form-input"
                  value={keysConfig.jiraEmail || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, jiraEmail: e.target.value })}
                  placeholder="admin@company.com"
                />
              </div>

              {/* Jira API Token */}
              <div className="form-group">
                <label className="form-label">
                  Jira API Token: {keysConfig.jiraTokenMasked && <span style={{ color: '#34d399' }}>(Đã lưu: {keysConfig.jiraTokenMasked})</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={keysConfig.jiraToken || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, jiraToken: e.target.value })}
                  placeholder="Nhập API Token mới nếu muốn thay đổi"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-start', marginTop: '0.4rem', fontSize: '0.75rem' }}
                  onClick={handleTestJira}
                  disabled={testingJira}
                >
                  {testingJira ? <div className="spinner" /> : <Shield size={14} />} Kiểm tra kết nối Jira
                </button>
              </div>

              {/* Google Gemini API Key */}
              <div className="form-group">
                <label className="form-label">
                  Google Gemini API Key: {keysConfig.geminiKeyMasked && <span style={{ color: '#34d399' }}>(Đã lưu: {keysConfig.geminiKeyMasked})</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={keysConfig.geminiKey || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, geminiKey: e.target.value })}
                  placeholder="AIzaSy..."
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-start', marginTop: '0.4rem', fontSize: '0.75rem' }}
                  onClick={handleTestGemini}
                  disabled={testingGemini}
                >
                  {testingGemini ? <div className="spinner" /> : <Sparkles size={14} />} Kiểm tra kết nối Gemini AI
                </button>
              </div>

              {/* n8n Webhook URL */}
              <div className="form-group">
                <label className="form-label">n8n Webhook URL (Phân tích Requirement):</label>
                <input
                  type="text"
                  className="form-input"
                  value={keysConfig.n8nWebhookUrl || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, n8nWebhookUrl: e.target.value })}
                  placeholder="http://localhost:5678/webhook/analyze-requirement"
                />
              </div>

              {/* Discord Webhook URL */}
              <div className="form-group">
                <label className="form-label">Discord Webhook URL (Thông báo tự động):</label>
                <input
                  type="text"
                  className="form-input"
                  value={keysConfig.discordWebhookUrl || ''}
                  onChange={(e) => setKeysConfig({ ...keysConfig, discordWebhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn-primary">
                  <Check size={16} /> Lưu Cấu hình Keys
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: XUẤT TÀI LIỆU & THÔNG BÁO (Luồng 11, 12 - Thành viên 4) */}
        {/* ========================================================================= */}
        {activeTab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '0 auto' }}>
            <div className="glass-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📄 Xuất Tài liệu Kỹ thuật (Export Documentation)
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Xuất toàn bộ cấu trúc Epic, User Story và Task kỹ thuật đã được phân rã thành file Markdown chuẩn để lưu trữ vào Git repo hoặc in ấn lưu hồ sơ.
              </p>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" onClick={handleDownloadMarkdown}>
                  <Download size={16} /> Tải file Markdown (.md)
                </button>
                <button className="btn-secondary" onClick={() => window.print()}>
                  🖨️ In ấn / Lưu định dạng PDF
                </button>
              </div>
            </div>

            {/* Test Automated Notification (Luồng 11) */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📢 Kiểm thử Kênh Thông báo Tự động (Discord / Slack)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Gửi thẻ thông báo mẫu dạng Rich Embed vào Discord Channel của nhóm qua Webhook.
              </p>

              <button className="btn-secondary" onClick={handleTestDiscordNotify}>
                <Bell size={16} color="var(--primary)" /> Bắn tin nhắn thử nghiệm tới Discord
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* AUTH MODAL (Đăng ký / Đăng nhập - Thành viên 1) */}
      {/* ========================================================================= */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              {authMode === 'login' ? 'Đăng nhập Hệ thống' : 'Đăng ký Tài khoản mới'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Hệ thống xác thực người dùng & cấp JWT Token qua Express.js (Thành viên 1)
            </p>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Họ và tên:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={authForm.fullName}
                    onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email:</label>
                <input
                  type="email"
                  className="form-input"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
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
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {authMode === 'login' ? 'Đăng nhập ngay' : 'Đăng ký tài khoản'}
              </button>
            </form>

            <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <>
                  Chưa có tài khoản?{' '}
                  <span
                    style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setAuthMode('register')}
                  >
                    Đăng ký ngay
                  </span>
                </>
              ) : (
                <>
                  Đã có tài khoản?{' '}
                  <span
                    style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setAuthMode('login')}
                  >
                    Đăng nhập
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW WORKSPACE MODAL (Thành viên 1) */}
      {/* ========================================================================= */}
      {showNewWorkspaceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Tạo Workspace Dự án mới
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Quản lý các thông tin dự án nội bộ trên web trước khi đẩy lên Jira
            </p>

            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label className="form-label">Tên Dự án / Workspace:</label>
                <input
                  type="text"
                  className="form-input"
                  value={newWorkspaceForm.name}
                  onChange={(e) => setNewWorkspaceForm({ ...newWorkspaceForm, name: e.target.value })}
                  placeholder="vd: Mobile Banking App"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả dự án:</label>
                <input
                  type="text"
                  className="form-input"
                  value={newWorkspaceForm.description}
                  onChange={(e) => setNewWorkspaceForm({ ...newWorkspaceForm, description: e.target.value })}
                  placeholder="Hệ thống ngân hàng số cho khách hàng cá nhân"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mã tiền tố Jira (Project Key):</label>
                <input
                  type="text"
                  className="form-input"
                  value={newWorkspaceForm.defaultJiraProjectKey}
                  onChange={(e) => setNewWorkspaceForm({ ...newWorkspaceForm, defaultJiraProjectKey: e.target.value.toUpperCase() })}
                  placeholder="MBANK"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowNewWorkspaceModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Tạo Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
