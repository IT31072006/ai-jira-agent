import React, { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import { configApi } from '../api/configApi';
import {
  Settings,
  Shield,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Save,
  Globe,
  Mail,
  Sparkles,
  Info,
  Bell,
  Send,
  MessageSquare,
} from 'lucide-react';

export const SettingsPage = () => {
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');

  // Flow 11: Notification state
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationChannel, setNotificationChannel] = useState('discord');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [testNotifSuccess, setTestNotifSuccess] = useState('');
  const [testNotifError, setTestNotifError] = useState('');

  const [showJiraToken, setShowJiraToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadConfig = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await configApi.getConfig();
      if (res && res.data) {
        setConfig(res.data);
        setJiraDomain(res.data.jira_domain || '');
        setJiraEmail(res.data.jira_email || '');
        setNotificationEnabled(res.data.notification_enabled !== false);
        setNotificationChannel(res.data.notification_channel || 'discord');
        setNotificationEmail(res.data.notification_email || '');
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Không thể tải cấu hình tích hợp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setErrorMsg('');
    setSuccessMsg('');

    // Chuẩn bị payload gửi lên Express
    const payload = {
      jira_domain: jiraDomain.trim(),
      jira_email: jiraEmail.trim(),
    };

    // Chỉ gửi token nếu user nhập giá trị mới (tránh ghi đè token cũ)
    if (jiraApiToken.trim().length > 0) {
      payload.jira_api_token = jiraApiToken.trim();
    }

    if (geminiApiKey.trim().length > 0) {
      payload.gemini_api_key = geminiApiKey.trim();
    }

    // Flow 11: Cấu hình thông báo tự động (Automated Notification)
    payload.notification_enabled = notificationEnabled;
    payload.notification_channel = notificationChannel;
    payload.notification_email = notificationEmail.trim();

    if (discordWebhookUrl.trim().length > 0) {
      payload.discord_webhook_url = discordWebhookUrl.trim();
    }
    if (slackWebhookUrl.trim().length > 0) {
      payload.slack_webhook_url = slackWebhookUrl.trim();
    }

    setIsSaving(true);
    try {
      const res = await configApi.updateConfig(payload);
      if (res && res.data) {
        setConfig(res.data);
        setJiraDomain(res.data.jira_domain || '');
        setJiraEmail(res.data.jira_email || '');
        setNotificationEnabled(res.data.notification_enabled !== false);
        setNotificationChannel(res.data.notification_channel || 'discord');
        setNotificationEmail(res.data.notification_email || '');
      }
      // Reset ô nhập secret về rỗng để bảo mật
      setJiraApiToken('');
      setGeminiApiKey('');
      setDiscordWebhookUrl('');
      setSlackWebhookUrl('');
      setSuccessMsg('✓ Cấu hình tích hợp đã được lưu và mã hóa AES-256 an toàn!');
      
      // Cuộn nhẹ lên đầu trang để người dùng thấy thông báo
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi lưu cấu hình tích hợp.';
      setErrorMsg(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveJira = async () => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa thông tin xác thực Jira?\nCác luồng sau này sẽ không thể tương tác với Jira cho đến khi bạn cấu hình lại.'
    );
    if (!confirmed) return;

    try {
      await configApi.deleteConfig('jira');
      setJiraDomain('');
      setJiraEmail('');
      setJiraApiToken('');
      await loadConfig();
      setSuccessMsg('Đã xóa thông tin xác thực Jira thành công.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Không thể xóa thông tin Jira.');
    }
  };

  const handleRemoveGemini = async () => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa Gemini API Key?\nCác tính năng phân tích AI trong luồng tiếp theo sẽ tạm ngưng hoạt động.'
    );
    if (!confirmed) return;

    try {
      await configApi.deleteConfig('gemini');
      setGeminiApiKey('');
      await loadConfig();
      setSuccessMsg('Đã xóa Gemini API Key thành công.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Không thể xóa Gemini API Key.');
    }
  };

  const handleTestNotification = async () => {
    setTestNotifSuccess('');
    setTestNotifError('');
    setIsTestingNotif(true);
    try {
      const res = await configApi.testNotification(notificationChannel);
      setTestNotifSuccess(res?.message || `✓ Đã gửi thông báo thử nghiệm thành công qua kênh ${notificationChannel.toUpperCase()}!`);
      setTimeout(() => setTestNotifSuccess(''), 6000);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi gửi thông báo thử nghiệm.';
      setTestNotifError(msg);
      setTimeout(() => setTestNotifError(''), 6000);
    } finally {
      setIsTestingNotif(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="dashboard-content settings-page-content">
        <div className="container">
          {/* Header với nút Lưu nổi bật ngay trên đầu trang */}
          <div className="settings-header">
            <div>
              <div className="header-subtitle">
                <Settings size={18} className="text-primary" />
                <span>Thiết lập môi trường & Dịch vụ ngoài</span>
              </div>
              <h1 className="projects-title">Cấu hình Tích hợp (Flow 3)</h1>
              <p className="text-muted">
                Quản lý khóa xác thực kết nối đến Jira REST API và Google Gemini API. Dữ liệu được mã hóa chuẩn quân sự AES-256-GCM.
              </p>
            </div>

            {/* Nút lưu ở header - không cần cuộn chuột vẫn bấm được */}
            <div className="header-action-group">
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary"
                disabled={isSaving || loading}
                id="header-save-config-btn"
              >
                {isSaving ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner"></span>
                    <span>Đang lưu...</span>
                  </span>
                ) : (
                  <span className="btn-content">
                    <Save size={18} />
                    <span>Lưu cấu hình</span>
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Alerts */}
          {successMsg && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} className="alert-icon" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="alert alert-error">
              <AlertCircle size={18} className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Đang tải cấu hình bảo mật...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="settings-form" noValidate>
              {/* Security Banner */}
              <div className="security-notice-banner">
                <Shield className="text-primary" size={24} />
                <div className="security-notice-text">
                  <h4>Bảo mật thông tin xác thực (AES-256-GCM)</h4>
                  <p>
                    API token và khóa bảo mật của bạn được mã hóa hoàn toàn trước khi lưu vào cơ sở dữ liệu PostgreSQL. Hệ thống không bao giờ hiển thị lại chuỗi bí mật đầy đủ trên giao diện hay trả về cho client.
                  </p>
                </div>
              </div>

              {/* Section 1: Jira Integration */}
              <div className="card settings-card">
                <div className="card-header settings-card-header">
                  <div className="card-title-group">
                    <Globe className="card-icon text-primary" size={20} />
                    <h3>1. Tích hợp Jira Cloud (Jira REST API)</h3>
                  </div>
                  {config?.jira_api_token_configured && (
                    <button
                      type="button"
                      className="btn-danger-subtle"
                      onClick={handleRemoveJira}
                      title="Gỡ bỏ cấu hình Jira"
                    >
                      <Trash2 size={14} />
                      <span>Xóa thông tin Jira</span>
                    </button>
                  )}
                </div>

                <div className="card-body">
                  <div className="form-group">
                    <label htmlFor="jira-domain">
                      Jira Domain / Host URL
                    </label>
                    <div className="input-with-icon">
                      <Globe className="input-icon" size={18} />
                      <input
                        id="jira-domain"
                        type="text"
                        placeholder="https://your-domain.atlassian.net"
                        value={jiraDomain}
                        onChange={(e) => setJiraDomain(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <span className="form-hint">
                      Ví dụ: <code>https://my-company.atlassian.net</code>
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="jira-email">
                      Jira Account Email
                    </label>
                    <div className="input-with-icon">
                      <Mail className="input-icon" size={18} />
                      <input
                        id="jira-email"
                        type="email"
                        placeholder="your-email@company.com"
                        value={jiraEmail}
                        onChange={(e) => setJiraEmail(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <span className="form-hint">
                      Email bạn sử dụng để đăng nhập vào tài khoản Atlassian Jira
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="jira-token">
                      Jira API Token
                    </label>
                    <div className="input-with-icon">
                      <Lock className="input-icon" size={18} />
                      <input
                        id="jira-token"
                        type={showJiraToken ? 'text' : 'password'}
                        placeholder={
                          config?.jira_api_token_configured
                            ? 'Để trống để giữ nguyên token hiện tại'
                            : 'Nhập Jira API Token mới...'
                        }
                        value={jiraApiToken}
                        onChange={(e) => setJiraApiToken(e.target.value)}
                        disabled={isSaving}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="toggle-password-btn"
                        onClick={() => setShowJiraToken(!showJiraToken)}
                        tabIndex={-1}
                      >
                        {showJiraToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Status badge for Jira */}
                    <div className="token-status-row">
                      {config?.jira_api_token_configured ? (
                        <div className="configured-pill">
                          <CheckCircle2 size={14} className="text-success" />
                          <span>Đang sử dụng token: <code>{config.jira_api_token_masked}</code></span>
                        </div>
                      ) : (
                        <div className="unconfigured-pill">
                          <Info size={14} className="text-muted" />
                          <span>Chưa cấu hình Jira Token</span>
                        </div>
                      )}
                      <a
                        href="https://id.atlassian.com/manage-profile/security/api-tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="external-token-link"
                      >
                        <span>Lấy API Token trên Atlassian</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Gemini Integration */}
              <div className="card settings-card">
                <div className="card-header settings-card-header">
                  <div className="card-title-group">
                    <Sparkles className="card-icon text-accent" size={20} />
                    <h3>2. Tích hợp AI (Google Gemini API)</h3>
                  </div>
                  {config?.gemini_api_key_configured && (
                    <button
                      type="button"
                      className="btn-danger-subtle"
                      onClick={handleRemoveGemini}
                      title="Gỡ bỏ Gemini Key"
                    >
                      <Trash2 size={14} />
                      <span>Xóa Gemini Key</span>
                    </button>
                  )}
                </div>

                <div className="card-body">
                  <div className="form-group">
                    <label htmlFor="gemini-key">
                      Gemini API Key
                    </label>
                    <div className="input-with-icon">
                      <KeyRound className="input-icon" size={18} />
                      <input
                        id="gemini-key"
                        type={showGeminiKey ? 'text' : 'password'}
                        placeholder={
                          config?.gemini_api_key_configured
                            ? 'Để trống để giữ nguyên API Key hiện tại'
                            : 'Nhập Google Gemini API Key mới (AIzaSy...)...'
                        }
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        disabled={isSaving}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="toggle-password-btn"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        tabIndex={-1}
                      >
                        {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Status badge for Gemini */}
                    <div className="token-status-row">
                      {config?.gemini_api_key_configured ? (
                        <div className="configured-pill">
                          <CheckCircle2 size={14} className="text-success" />
                          <span>Đang sử dụng API Key: <code>{config.gemini_api_key_masked}</code></span>
                        </div>
                      ) : (
                        <div className="unconfigured-pill">
                          <Info size={14} className="text-muted" />
                          <span>Chưa cấu hình Gemini API Key</span>
                        </div>
                      )}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="external-token-link"
                      >
                        <span>Lấy API Key trên Google AI Studio</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Automated Notification (Flow 11) */}
              <div className="card settings-card">
                <div className="card-header settings-card-header">
                  <div className="card-title-group">
                    <Bell className="card-icon text-primary" size={20} />
                    <h3>3. Tự động Gửi Thông báo (Flow 11 — n8n Automated Notification)</h3>
                  </div>
                </div>

                <div className="card-body">
                  {/* Bật/Tắt tính năng thông báo */}
                  <div className="notification-toggle-wrapper">
                    <div className="notification-toggle-info">
                      <span className="notification-toggle-title">Kích hoạt thông báo tự động khi tạo Epic thành công</span>
                      <span className="notification-toggle-desc">
                        Khi Flow 7 tạo Epic thành công trên Jira Cloud, hệ thống tự động phát sự kiện qua n8n để thông báo ngay lập tức.
                      </span>
                    </div>
                    <label className="toggle-switch-label" htmlFor="notification-toggle">
                      <input
                        id="notification-toggle"
                        type="checkbox"
                        checked={notificationEnabled}
                        onChange={(e) => setNotificationEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  {notificationEnabled && (
                    <>
                      {/* Chọn kênh nhận thông báo */}
                      <div className="form-group">
                        <label>Chọn kênh thông báo ưu tiên</label>
                        <div className="channel-selector-grid">
                          <div
                            className={`channel-card-option discord ${notificationChannel === 'discord' ? 'active' : ''}`}
                            onClick={() => setNotificationChannel('discord')}
                          >
                            {notificationChannel === 'discord' && <span className="channel-active-indicator" />}
                            <div className="channel-icon-badge discord">
                              <MessageSquare size={20} />
                            </div>
                            <span className="channel-card-name">Discord Webhook</span>
                            <span className="channel-card-sub">Kênh Discord Team</span>
                          </div>

                          <div
                            className={`channel-card-option slack ${notificationChannel === 'slack' ? 'active' : ''}`}
                            onClick={() => setNotificationChannel('slack')}
                          >
                            {notificationChannel === 'slack' && <span className="channel-active-indicator" />}
                            <div className="channel-icon-badge slack">
                              <MessageSquare size={20} />
                            </div>
                            <span className="channel-card-name">Slack Webhook</span>
                            <span className="channel-card-sub">Kênh Slack Team</span>
                          </div>

                          <div
                            className={`channel-card-option email ${notificationChannel === 'email' ? 'active' : ''}`}
                            onClick={() => setNotificationChannel('email')}
                          >
                            {notificationChannel === 'email' && <span className="channel-active-indicator" />}
                            <div className="channel-icon-badge email">
                              <Mail size={20} />
                            </div>
                            <span className="channel-card-name">Email (SMTP)</span>
                            <span className="channel-card-sub">Hộp thư nhận tin</span>
                          </div>
                        </div>
                      </div>

                      {/* Chi tiết cấu hình theo kênh */}
                      {notificationChannel === 'discord' && (
                        <div className="form-group">
                          <label htmlFor="discord-webhook">Discord Webhook URL</label>
                          <div className="input-with-icon">
                            <MessageSquare className="input-icon" size={18} />
                            <input
                              id="discord-webhook"
                              type="text"
                              placeholder={
                                config?.discord_webhook_url_configured
                                  ? 'Để trống để giữ nguyên Discord Webhook hiện tại'
                                  : 'https://discord.com/api/webhooks/...'
                              }
                              value={discordWebhookUrl}
                              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                          <div className="token-status-row">
                            {config?.discord_webhook_url_configured ? (
                              <div className="configured-pill">
                                <CheckCircle2 size={14} className="text-success" />
                                <span>Đang sử dụng Webhook: <code>{config.discord_webhook_url_masked}</code></span>
                              </div>
                            ) : (
                              <div className="unconfigured-pill">
                                <Info size={14} className="text-muted" />
                                <span>Chưa cấu hình Discord Webhook</span>
                              </div>
                            )}
                            <a
                              href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                              target="_blank"
                              rel="noreferrer"
                              className="external-token-link"
                            >
                              <span>Cách lấy Discord Webhook</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      )}

                      {notificationChannel === 'slack' && (
                        <div className="form-group">
                          <label htmlFor="slack-webhook">Slack Incoming Webhook URL</label>
                          <div className="input-with-icon">
                            <MessageSquare className="input-icon" size={18} />
                            <input
                              id="slack-webhook"
                              type="text"
                              placeholder={
                                config?.slack_webhook_url_configured
                                  ? 'Để trống để giữ nguyên Slack Webhook hiện tại'
                                  : 'https://hooks.slack.com/services/...'
                              }
                              value={slackWebhookUrl}
                              onChange={(e) => setSlackWebhookUrl(e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                          <div className="token-status-row">
                            {config?.slack_webhook_url_configured ? (
                              <div className="configured-pill">
                                <CheckCircle2 size={14} className="text-success" />
                                <span>Đang sử dụng Webhook: <code>{config.slack_webhook_url_masked}</code></span>
                              </div>
                            ) : (
                              <div className="unconfigured-pill">
                                <Info size={14} className="text-muted" />
                                <span>Chưa cấu hình Slack Webhook</span>
                              </div>
                            )}
                            <a
                              href="https://api.slack.com/messaging/webhooks"
                              target="_blank"
                              rel="noreferrer"
                              className="external-token-link"
                            >
                              <span>Cách tạo Slack Incoming Webhook</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      )}

                      {notificationChannel === 'email' && (
                        <div className="form-group">
                          <label htmlFor="notif-email">Email Nhận Thông Báo</label>
                          <div className="input-with-icon">
                            <Mail className="input-icon" size={18} />
                            <input
                              id="notif-email"
                              type="email"
                              placeholder="team-alerts@company.com"
                              value={notificationEmail}
                              onChange={(e) => setNotificationEmail(e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                          <span className="form-hint">
                            Địa chỉ email nhóm nhận thông báo mỗi khi Epic mới được tạo thành công trên Jira.
                          </span>
                        </div>
                      )}

                      {/* Thanh thử nghiệm thông báo */}
                      <div className="test-notification-bar">
                        <div className="test-notification-info">
                          <Send size={18} className="text-primary" />
                          <div>
                            <strong>Kiểm tra thông báo thử nghiệm</strong>
                            <p>Gửi một thông báo mẫu qua cỗ máy n8n để kiểm tra kết nối tới kênh đã chọn.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-test-notif"
                          onClick={handleTestNotification}
                          disabled={isTestingNotif || isSaving}
                          id="btn-test-notification"
                        >
                          {isTestingNotif ? (
                            <span className="btn-spinner"></span>
                          ) : (
                            <Send size={15} />
                          )}
                          <span>{isTestingNotif ? 'Đang gửi thử...' : 'Gửi thông báo thử nghiệm'}</span>
                        </button>
                      </div>

                      {testNotifSuccess && (
                        <div className="test-notif-feedback success">
                          <CheckCircle2 size={16} />
                          <span>{testNotifSuccess}</span>
                        </div>
                      )}

                      {testNotifError && (
                        <div className="test-notif-feedback error">
                          <AlertCircle size={16} />
                          <span>{testNotifError}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons ở cuối trang */}
              <div className="settings-submit-bar">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={isSaving}
                  id="bottom-save-config-btn"
                >
                  {isSaving ? (
                    <span className="btn-loading-content">
                      <span className="btn-spinner"></span>
                      <span>Đang lưu & mã hóa...</span>
                    </span>
                  ) : (
                    <span className="btn-content">
                      <Save size={18} />
                      <span>Lưu cấu hình</span>
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
