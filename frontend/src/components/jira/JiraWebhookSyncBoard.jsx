import { useState, useEffect, useMemo } from 'react';
import { jiraApi } from '../../api/jiraApi';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  Clock,
  PlayCircle,
  ExternalLink,
  AlertCircle,
  Send,
  Sliders,
  Webhook,
  User,
  Copy,
  Check,
  Terminal,
  Globe,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export const JiraWebhookSyncBoard = ({ project }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Webhook HTTPS & Cloudflare Tunnel State
  const [backendWebhookUrl, setBackendWebhookUrl] = useState('');
  const [isSecretConfigured, setIsSecretConfigured] = useState(false);
  const [customTunnelUrl, setCustomTunnelUrl] = useState(() => {
    return localStorage.getItem('jira_public_tunnel_url') || '';
  });
  const [tunnelInput, setTunnelInput] = useState(() => {
    return localStorage.getItem('jira_public_tunnel_url') || '';
  });
  const [showTunnelInput, setShowTunnelInput] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Simulator state
  const [simKey, setSimKey] = useState('');
  const [simStatus, setSimStatus] = useState('Done');
  const [simAssignee, setSimAssignee] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Lấy projectKey: ưu tiên project.project_key đã lưu trong PostgreSQL
  const getProjectKey = () => {
    if (project?.project_key) return project.project_key.trim().toUpperCase();
    if (!project?.name) return '';
    const clean = project.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    return clean.length >= 2 ? clean.slice(0, 6) : '';
  };

  const projectKey = getProjectKey();

  const fetchSyncedIssues = async (reconcileWithJira = false) => {
    try {
      setLoading(true);
      setError('');
      const data = await jiraApi.getSyncedIssues({
        projectKey: projectKey || undefined,
        projectId: project?.id || undefined,
        sync: reconcileWithJira ? 'true' : undefined,
      });
      setIssues(data.issues || []);
      if (data.publicWebhookUrl) {
        setBackendWebhookUrl(data.publicWebhookUrl);
      }
      if (data.isWebhookSecretConfigured !== undefined) {
        setIsSecretConfigured(Boolean(data.isWebhookSecretConfigured));
      }
      if (reconcileWithJira) {
        setSuccessMsg('✓ Đã đồng bộ đối soát trạng thái mới nhất trực tiếp từ Jira Cloud!');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể tải danh sách issue đã đồng bộ từ database.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    jiraApi
      .getSyncedIssues({
        projectKey: projectKey || undefined,
        projectId: project?.id || undefined,
      })
      .then((data) => {
        if (isMounted) {
          setIssues(data.issues || []);
          if (data.publicWebhookUrl) {
            setBackendWebhookUrl(data.publicWebhookUrl);
          }
          if (data.isWebhookSecretConfigured !== undefined) {
            setIsSecretConfigured(Boolean(data.isWebhookSecretConfigured));
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              'Không thể tải danh sách issue đã đồng bộ từ database.'
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectKey, project?.id]);

  // Xử lý gửi Webhook giả lập (test)
  const handleSimulateSync = async (e, directKey = null, directStatus = null) => {
    if (e && e.preventDefault) e.preventDefault();

    const targetKey = (directKey || simKey || '').trim().toUpperCase();
    const targetStatus = directStatus || simStatus;

    if (!targetKey) {
      setError('Vui lòng nhập mã Issue (ví dụ: KAN-1, PROJ-12).');
      return;
    }

    try {
      setSimLoading(true);
      setError('');
      setSuccessMsg('');

      await jiraApi.simulateWebhookSync({
        issueKey: targetKey,
        status: targetStatus,
        assignee: simAssignee || undefined,
        projectKey: projectKey || targetKey.split('-')[0],
      });

      setSuccessMsg(
        `✓ [Webhook Sync] Đã cập nhật thành công issue ${targetKey} sang trạng thái "${targetStatus}"!`
      );
      setTimeout(() => setSuccessMsg(''), 5000);

      // Cập nhật lại danh sách issue
      await fetchSyncedIssues();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Có lỗi khi bắn sự kiện Webhook đồng bộ.'
      );
    } finally {
      setSimLoading(false);
    }
  };

  // Xác định URL Webhook công khai hiệu lực
  const getEffectiveWebhookUrl = () => {
    if (customTunnelUrl && customTunnelUrl.trim()) {
      const clean = customTunnelUrl.trim().replace(/\/+$/, '');
      return `${clean}/api/jira/webhook-sync`;
    }
    if (backendWebhookUrl && backendWebhookUrl.trim()) {
      return backendWebhookUrl.trim();
    }
    const envUrl = import.meta.env.VITE_PUBLIC_WEBHOOK_BASE_URL;
    if (envUrl && envUrl.trim()) {
      return `${envUrl.trim().replace(/\/+$/, '')}/api/jira/webhook-sync`;
    }
    return '';
  };

  const effectiveWebhookUrl = getEffectiveWebhookUrl();
  const isHttps = effectiveWebhookUrl.startsWith('https://');

  const handleCopyUrl = () => {
    if (!effectiveWebhookUrl) return;
    navigator.clipboard.writeText(effectiveWebhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyCommand = () => {
    const cmd = 'cloudflared tunnel --url http://localhost:5000';
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleSaveTunnelUrl = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = tunnelInput.trim().replace(/\/+$/, '');
    if (clean && !clean.startsWith('https://')) {
      setError('URL Cloudflare Tunnel bắt buộc phải sử dụng giao thức HTTPS (ví dụ: https://your-tunnel.trycloudflare.com).');
      return;
    }
    setError('');
    setCustomTunnelUrl(clean);
    if (clean) {
      localStorage.setItem('jira_public_tunnel_url', clean);
      setSuccessMsg('✓ Đã áp dụng HTTPS Tunnel URL cho Jira Cloud Webhook!');
    } else {
      localStorage.removeItem('jira_public_tunnel_url');
      setSuccessMsg('✓ Đã khôi phục Webhook URL mặc định từ Backend.');
    }
    setTimeout(() => setSuccessMsg(''), 4000);
    setShowTunnelInput(false);
  };

  const handleResetTunnelUrl = () => {
    setTunnelInput('');
    setCustomTunnelUrl('');
    localStorage.removeItem('jira_public_tunnel_url');
    setSuccessMsg('✓ Đã khôi phục URL mặc định.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Phân trang danh sách Issue để tối ưu hiệu năng hiển thị DOM
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Hàm chuẩn hóa và nhận diện chính xác trạng thái từ Jira Workflow
  const isDoneStatus = (status, category) => {
    const s = (status || '').toLowerCase().trim();
    const c = (category || '').toLowerCase().trim();
    return (
      c === 'done' ||
      s === 'done' ||
      s === 'hoàn thành' ||
      s === 'resolved' ||
      s === 'closed' ||
      s === 'complete' ||
      s === 'completed'
    );
  };

  const isInProgressStatus = (status, category) => {
    const s = (status || '').toLowerCase().trim();
    const c = (category || '').toLowerCase().trim();
    return (
      c === 'in progress' ||
      c.includes('progress') ||
      s.includes('progress') ||
      s.includes('đang làm') ||
      s.includes('in dev') ||
      s.includes('review') ||
      s.includes('testing') ||
      s.includes('qa')
    );
  };

  // Thống kê nhanh được memoize để tránh tính toán lại không cần thiết
  const { totalCount, doneCount, inProgressCount, todoCount } = useMemo(() => {
    const total = issues.length;
    const done = issues.filter((i) => isDoneStatus(i.status, i.status_category)).length;
    const inProgress = issues.filter((i) => isInProgressStatus(i.status, i.status_category)).length;
    const todo = Math.max(0, total - done - inProgress);
    return { totalCount: total, doneCount: done, inProgressCount: inProgress, todoCount: todo };
  }, [issues]);

  const totalPages = Math.ceil(issues.length / pageSize) || 1;
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return issues.slice(start, start + pageSize);
  }, [issues, currentPage, pageSize]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Vừa xong';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' ' + d.toLocaleDateString('vi-VN');
  };

  return (
    <div id="synced-issues-board" className="card jira-webhook-board-card" style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <Activity className="card-icon text-accent" size={22} />
          <div>
            <h3>Đồng bộ Trạng thái Ngược từ Jira (Luồng 9: Webhook Sync)</h3>
            <p className="text-muted" style={{ fontSize: '0.825rem', margin: 0 }}>
              Express.js API tự động lắng nghe Webhook khi task trên Jira chuyển trạng thái và cập nhật tức thì vào website
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => fetchSyncedIssues(true)}
            disabled={loading}
            title="Kéo trạng thái mới nhất trực tiếp từ Jira Cloud để đối soát tức thì"
          >
            <RefreshCw size={13} className={loading ? 'btn-spinner' : ''} />
            <span>Đồng bộ từ Jira Cloud</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => setShowGuide(!showGuide)}
          >
            <Webhook size={13} />
            <span>{showGuide ? 'Ẩn cấu hình' : 'Cấu hình Jira Webhook'}</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => fetchSyncedIssues(false)}
            disabled={loading}
            title="Làm mới lại dữ liệu từ cơ sở dữ liệu website"
          >
            <RefreshCw size={13} className={loading ? 'btn-spinner' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Phần 1: Cấu hình Webhook Thực tế từ Atlassian Jira Cloud */}
        {showGuide && (
          <div className="webhook-guide-banner">
            <div className="webhook-guide-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} className="text-primary" />
                <strong>Cấu hình Webhook Thực tế trên Atlassian Jira Cloud (Production / Live Demo):</strong>
              </div>
              {effectiveWebhookUrl && isHttps ? (
                <span className="tunnel-status-badge tunnel-badge-valid">
                  <ShieldCheck size={13} />
                  HTTPS Sẵn sàng cho Jira Cloud
                </span>
              ) : (
                <span className="tunnel-status-badge tunnel-badge-warning">
                  <AlertTriangle size={13} />
                  Cần URL HTTPS (Cloudflare Tunnel)
                </span>
              )}
            </div>

            {/* Phân biệt rõ Local Backend vs Public Webhook */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.65rem 0', fontSize: '0.78rem' }}>
              <span className="network-route-tag">
                🖥️ <strong>Local Backend:</strong> <code>http://localhost:5000</code> (Chỉ truy cập nội bộ máy này)
              </span>
              <span className="network-route-tag">
                🌐 <strong>Public HTTPS Webhook:</strong>{' '}
                {effectiveWebhookUrl && isHttps ? (
                  <code style={{ color: '#4ade80' }}>{effectiveWebhookUrl}</code>
                ) : (
                  <span style={{ color: '#facc15' }}>Chưa mở Cloudflare Tunnel</span>
                )}
              </span>
            </div>

            {/* Trường hợp A: Đã có HTTPS Webhook URL hợp lệ */}
            {effectiveWebhookUrl && isHttps ? (
              <>
                <p style={{ fontSize: '0.825rem', color: '#cbd5e1', margin: '0.4rem 0' }}>
                  Vào Jira Cloud: <strong>Jira Settings ➔ System ➔ WebHooks ➔ Create a WebHook</strong>, sau đó điền thông tin:
                </p>

                <div className="webhook-url-box">
                  <div className="webhook-url-code-group">
                    <span className="webhook-method">POST</span>
                    <code>{effectiveWebhookUrl}</code>
                  </div>
                  <button
                    type="button"
                    className={`webhook-copy-btn ${copiedUrl ? 'copied' : ''}`}
                    onClick={handleCopyUrl}
                    title="Sao chép URL Webhook"
                  >
                    {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedUrl ? 'Đã sao chép!' : 'Sao chép HTTPS URL'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: '#94a3b8', margin: '0.5rem 0' }}>
                  <div>
                    ✓ Sự kiện cần tick: <strong>Issue ➔ updated</strong> (Khi ai đó chuyển trạng thái task trên Jira Board, Webhook sẽ tự bắn về API Express).
                  </div>
                  <div>
                    🔒 Secret: {isSecretConfigured ? (
                      <span style={{ color: '#38bdf8' }}>Backend đang kích hoạt kiểm tra chữ ký HMAC (X-Hub-Signature). Hãy nhập secret khớp với biến JIRA_WEBHOOK_SECRET.</span>
                    ) : (
                      <span>Để trống trường Secret (Leave blank for no secret) theo mặc định Jira Cloud.</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                    onClick={() => setShowTunnelInput(!showTunnelInput)}
                  >
                    <Sliders size={12} />
                    <span>{showTunnelInput ? 'Đóng cấu hình Tunnel' : 'Đổi / Cập nhật URL Cloudflare Tunnel'}</span>
                  </button>
                </div>
              </>
            ) : (
              /* Trường hợp B: Chưa có HTTPS URL - Hướng dẫn mở Cloudflare Tunnel */
              <div className="tunnel-guide-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#facc15', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <AlertCircle size={16} />
                  <span>Jira Cloud yêu cầu HTTPS: Không thể sử dụng "http://localhost:5000" trực tiếp trên Jira Cloud!</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0.3rem 0' }}>
                  Atlassian Jira Cloud chỉ cho phép Webhook sử dụng giao thức <strong>HTTPS</strong> công khai. Hãy mở Cloudflare Tunnel trên Terminal Ubuntu để nhận HTTPS URL miễn phí:
                </p>

                <div className="tunnel-cmd-box">
                  <code>cloudflared tunnel --url http://localhost:5000</code>
                  <button
                    type="button"
                    className={`webhook-copy-btn ${copiedCmd ? 'copied' : ''}`}
                    onClick={handleCopyCommand}
                  >
                    {copiedCmd ? <Check size={13} /> : <Terminal size={13} />}
                    <span>{copiedCmd ? 'Đã sao chép lệnh!' : 'Sao chép lệnh'}</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.5rem 0 0.25rem 0' }}>
                  Sau khi chạy lệnh, Terminal sẽ cấp URL có dạng <code>https://&lt;id&gt;.trycloudflare.com</code>. Dán vào bên dưới để kích hoạt:
                </p>

                <form onSubmit={handleSaveTunnelUrl} className="tunnel-input-row">
                  <input
                    type="text"
                    className="form-control"
                    style={{ maxWidth: '420px', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    placeholder="https://your-tunnel.trycloudflare.com"
                    value={tunnelInput}
                    onChange={(e) => setTunnelInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    disabled={!tunnelInput.trim()}
                  >
                    Áp dụng URL Tunnel
                  </button>
                  {customTunnelUrl && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                      onClick={handleResetTunnelUrl}
                    >
                      Đặt lại
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* Form chỉnh sửa nhanh khi đang mở modal */}
            {effectiveWebhookUrl && isHttps && showTunnelInput && (
              <form onSubmit={handleSaveTunnelUrl} className="tunnel-input-row" style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(15, 23, 42, 0.65)', borderRadius: '6px' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: '380px', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  placeholder="https://your-new-tunnel.trycloudflare.com"
                  value={tunnelInput}
                  onChange={(e) => setTunnelInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  disabled={!tunnelInput.trim()}
                >
                  Cập nhật URL
                </button>
                {customTunnelUrl && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    onClick={handleResetTunnelUrl}
                  >
                    Khôi phục mặc định
                  </button>
                )}
              </form>
            )}
          </div>
        )}


        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircle2 size={18} className="alert-icon" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thống kê 3 trạng thái */}
        <div className="jira-sync-stats-grid">
          <div className="jira-sync-stat-card">
            <span className="stat-label">TỔNG ISSUES ĐỒNG BỘ</span>
            <span className="stat-value text-primary">{totalCount}</span>
          </div>
          <div className="jira-sync-stat-card">
            <span className="stat-label">CẦN LÀM (TO DO)</span>
            <span className="stat-value text-muted">{todoCount > 0 ? todoCount : 0}</span>
          </div>
          <div className="jira-sync-stat-card">
            <span className="stat-label">ĐANG LÀM (IN PROGRESS)</span>
            <span className="stat-value" style={{ color: '#38bdf8' }}>{inProgressCount}</span>
          </div>
          <div className="jira-sync-stat-card">
            <span className="stat-label">HOÀN THÀNH (DONE)</span>
            <span className="stat-value" style={{ color: '#4ade80' }}>{doneCount}</span>
          </div>
        </div>

        {/* Khung Giả lập Webhook để demo / thuyết trình cho Giảng viên */}
        <div className="webhook-simulator-section">
          <div className="simulator-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={16} className="text-accent" />
              <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc' }}>
                Bộ công cụ Thử nghiệm: Giả lập Sự kiện Jira Webhook (Live Demo)
              </h5>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Dành cho thuyết trình: Giả lập Jira bắn sự kiện chuyển trạng thái về Express
            </span>
          </div>

          <form onSubmit={handleSimulateSync} className="simulator-form">
            <div className="simulator-inputs">
              <div className="sim-field">
                <label>Mã Issue (Issue Key)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: KAN-1, PROJ-2"
                  value={simKey}
                  onChange={(e) => setSimKey(e.target.value.toUpperCase())}
                  disabled={simLoading}
                />
              </div>

              <div className="sim-field">
                <label>Trạng thái mới</label>
                <select
                  className="form-control"
                  value={simStatus}
                  onChange={(e) => setSimStatus(e.target.value)}
                  disabled={simLoading}
                >
                  <option value="Done">Done (Hoàn thành)</option>
                  <option value="In Progress">In Progress (Đang làm)</option>
                  <option value="To Do">To Do (Cần làm)</option>
                </select>
              </div>

              <div className="sim-field">
                <label>Người cập nhật (Tùy chọn)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: Nguyễn Văn A"
                  value={simAssignee}
                  onChange={(e) => setSimAssignee(e.target.value)}
                  disabled={simLoading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-sim-send"
                disabled={simLoading || !simKey.trim()}
              >
                {simLoading ? (
                  <>
                    <span className="btn-spinner" style={{ width: 14, height: 14 }}></span>
                    <span>Đang bắn Webhook...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Bắn Webhook giả lập</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bảng Danh sách Issue đã đồng bộ */}
        <div className="synced-issues-table-container">
          <div className="table-header-info">
            <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#f1f5f9' }}>
              DANH SÁCH ISSUES ĐÃ ĐỒNG BỘ CỦA WORKSPACE ({issues.length})
            </h5>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Tự động cập nhật mỗi khi có Webhook từ Jira gửi về cho dự án này
            </span>
          </div>

          {loading ? (
            <div className="loading-container" style={{ padding: '2rem 0' }}>
              <div className="spinner"></div>
              <p>Đang tải dữ liệu đồng bộ từ database...</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="empty-sync-state">
              <Activity size={32} className="text-muted" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
              <p style={{ color: '#cbd5e1', fontWeight: 500, margin: '0 0 0.35rem 0' }}>
                Chưa có issue nào thuộc Workspace này trong cơ sở dữ liệu
              </p>
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>
                Bạn có thể bấm <strong>"Đẩy dữ liệu lên Jira"</strong> ở Luồng 7 ở trên, hoặc dùng khung <strong>"Bắn Webhook giả lập"</strong> để thử nghiệm ngay!
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="sync-table">
                <thead>
                  <tr>
                    <th>Mã Issue</th>
                    <th>Loại</th>
                    <th>Tiêu đề Task</th>
                    <th>Người phụ trách</th>
                    <th>Trạng thái Hiện tại</th>
                    <th>Thời gian Đồng bộ</th>
                    <th>Hành động Demo</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIssues.map((iss) => {
                    const isDone = isDoneStatus(iss.status, iss.status_category);
                    const isInProgress = isInProgressStatus(iss.status, iss.status_category);

                    return (
                      <tr key={iss.id || iss.issue_key}>
                        <td>
                          <span className="jira-key-badge">{iss.issue_key}</span>
                        </td>
                        <td>
                          <span
                            className={`jira-badge ${
                              iss.issue_type === 'Epic'
                                ? 'badge-jira-epic'
                                : iss.issue_type === 'Story'
                                ? 'badge-jira-story'
                                : 'badge-jira-subtask'
                            }`}
                          >
                            {iss.issue_type || 'Task'}
                          </span>
                        </td>
                        <td className="task-summary-cell" title={iss.summary}>
                          <span>{iss.summary}</span>
                        </td>
                        <td>
                          {iss.assignee ? (
                            <span className="assignee-text">
                              <User size={12} className="text-primary" />
                              <span>{iss.assignee}</span>
                            </span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                              Chưa giao
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`sync-status-badge ${
                              isDone ? 'status-done' : isInProgress ? 'status-progress' : 'status-todo'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 size={12} />
                            ) : isInProgress ? (
                              <Clock size={12} />
                            ) : (
                              <PlayCircle size={12} />
                            )}
                            <span>{iss.status}</span>
                          </span>
                        </td>
                        <td className="timestamp-cell">
                          {formatDate(iss.last_synced_at || iss.updated_at)}
                        </td>
                        <td>
                          <div className="quick-actions-row">
                            {!isDone && (
                              <button
                                type="button"
                                className="btn-quick-sync btn-quick-done"
                                title="Giả lập chuyển sang Done"
                                onClick={(e) => handleSimulateSync(e, iss.issue_key, 'Done')}
                                disabled={simLoading}
                              >
                                ➔ Done
                              </button>
                            )}
                            {!isInProgress && (
                              <button
                                type="button"
                                className="btn-quick-sync btn-quick-progress"
                                title="Giả lập chuyển sang In Progress"
                                onClick={(e) =>
                                  handleSimulateSync(e, iss.issue_key, 'In Progress')
                                }
                                disabled={simLoading}
                              >
                                ➔ In Progress
                              </button>
                            )}
                            {iss.jira_url && (
                              <a
                                href={iss.jira_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="jira-table-link"
                                title="Mở trên Jira Cloud"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {issues.length > pageSize && (
                <div
                  className="table-pagination"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.825rem',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    Hiển thị <strong>{(currentPage - 1) * pageSize + 1}</strong> –{' '}
                    <strong>{Math.min(currentPage * pageSize, issues.length)}</strong> trên tổng số{' '}
                    <strong>{issues.length}</strong> issues
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      ‹ Trang trước
                    </button>
                    <span
                      style={{
                        padding: '0 0.5rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Trang sau ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JiraWebhookSyncBoard;
