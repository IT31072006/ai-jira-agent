import React, { useState, useEffect } from 'react';
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
  Info,
} from 'lucide-react';

export const JiraWebhookSyncBoard = ({ project }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simulator state
  const [simKey, setSimKey] = useState('');
  const [simStatus, setSimStatus] = useState('Done');
  const [simAssignee, setSimAssignee] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Lấy projectKey mặc định từ project
  const getProjectKey = () => {
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

  const fetchSyncedIssues = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await jiraApi.getSyncedIssues(projectKey || undefined);
      setIssues(data.issues || []);
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
    fetchSyncedIssues();
  }, [projectKey]);

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

      const res = await jiraApi.simulateWebhookSync({
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

  // Thống kê nhanh
  const totalCount = issues.length;
  const doneCount = issues.filter(
    (i) => i.status?.toLowerCase() === 'done' || i.status_category?.toLowerCase() === 'done'
  ).length;
  const inProgressCount = issues.filter(
    (i) =>
      i.status?.toLowerCase().includes('progress') ||
      i.status_category?.toLowerCase().includes('progress')
  ).length;
  const todoCount = totalCount - doneCount - inProgressCount;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Vừa xong';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' ' + d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="card jira-webhook-board-card" style={{ marginTop: '2rem' }}>
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
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setShowGuide(!showGuide)}
          >
            <Webhook size={14} />
            <span>{showGuide ? 'Ẩn cấu hình' : 'URL Webhook Jira'}</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={fetchSyncedIssues}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'btn-spinner' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Hướng dẫn cấu hình Jira Webhook thật */}
        {showGuide && (
          <div className="webhook-guide-banner">
            <div className="webhook-guide-header">
              <Info size={16} className="text-primary" />
              <strong>Hướng dẫn cấu hình Webhook trên Atlassian Jira Cloud:</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.4rem 0' }}>
              Vào Jira Cloud: <strong>Jira Settings ➔ System ➔ WebHooks ➔ Create a WebHook</strong>:
            </p>
            <div className="webhook-url-box">
              <span className="webhook-method">POST</span>
              <code>http://localhost:5000/api/jira/webhook-sync</code>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.3rem 0 0 0' }}>
              Tick chọn sự kiện: <strong>Issue ➔ updated</strong> (Khi ai đó chuyển trạng thái task trên Jira, Webhook sẽ tự bắn về API Express này).
            </p>
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
              DANH SÁCH ISSUES ĐÃ ĐỒNG BỘ TỪ JIRA ({issues.length})
            </h5>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Tự động cập nhật mỗi khi có Webhook từ Jira gửi về
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
                Chưa có issue nào được lưu hoặc đồng bộ trong database
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
                  {issues.map((iss) => {
                    const isDone =
                      iss.status?.toLowerCase() === 'done' ||
                      iss.status_category?.toLowerCase() === 'done';
                    const isInProgress =
                      iss.status?.toLowerCase().includes('progress') ||
                      iss.status_category?.toLowerCase().includes('progress');

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JiraWebhookSyncBoard;
