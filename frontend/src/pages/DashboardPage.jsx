import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import { projectApi } from '../api/projectApi';
import { dashboardApi } from '../api/dashboardApi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import {
  FolderGit2,
  Bookmark,
  BookOpen,
  CheckSquare,
  Calendar,
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Database,
  Layers,
  Sparkles,
  ShieldCheck,
  Activity,
} from 'lucide-react';

// Custom Tooltip cho Recharts tương thích dark mode
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="recharts-custom-tooltip">
        <div className="tooltip-title">{label}</div>
        {payload.map((entry, index) => (
          <div key={`tooltip-item-${index}`} className="tooltip-row">
            <span>
              <span
                className="tooltip-dot"
                style={{ backgroundColor: entry.color || entry.fill }}
              ></span>
              {entry.name}:
            </span>
            <strong>{entry.value}</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const DashboardPage = () => {
  const { user } = useAuth();

  // State quản lý dự án & bộ lọc
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // State dữ liệu thống kê Luồng 10
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [statusDist, setStatusDist] = useState(null);
  const [trend, setTrend] = useState(null);

  // State trạng thái UI
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // 1. Tải danh sách dự án của người dùng để populate vào dropdown lọc
  const fetchUserProjects = useCallback(async () => {
    try {
      const res = await projectApi.getProjects();
      setProjects(res.projects || []);
    } catch (err) {
      console.error('Không thể tải danh sách dự án:', err);
    }
  }, []);

  // 2. Tải toàn bộ dữ liệu thống kê từ Backend
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const [summaryRes, breakdownRes, statusRes, trendRes] = await Promise.all([
        dashboardApi.getSummary(selectedProjectId || undefined),
        dashboardApi.getIssueBreakdown(selectedProjectId || undefined),
        dashboardApi.getStatusDistribution(selectedProjectId || undefined),
        dashboardApi.getCreationTrend(selectedProjectId || undefined),
      ]);

      setSummary(summaryRes.data || null);
      setBreakdown(breakdownRes.data || null);
      setStatusDist(statusRes.data || null);
      setTrend(trendRes.data || null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Dashboard:', err);
      setError(
        err?.response?.data?.message || 'Không thể tải dữ liệu thống kê. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchUserProjects();
  }, [fetchUserProjects]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
  };

  // Chuẩn bị dữ liệu cho biểu đồ cột so sánh
  const breakdownChartData = breakdown?.breakdown?.map((item) => ({
    name: item.name,
    'Tháng này': item.thisMonth,
    'Toàn thời gian': item.allTime,
  })) || [];

  // Chuẩn bị dữ liệu cho biểu đồ tròn trạng thái
  const statusPieData = statusDist?.distribution?.filter((d) => d.count > 0) || [];

  // Chuẩn bị dữ liệu cho biểu đồ đường xu hướng
  const trendChartData = trend?.trend || [];

  // Định dạng ngày hiển thị
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const currentMonthDisplay = new Date().toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="dashboard-content">
        <div className="container">
          {/* Header Bar với Bộ lọc và Nút Refresh */}
          <div className="dashboard-header-bar">
            <div className="dashboard-title-group">
              <div className="dashboard-header-icon">
                <BarChart3 size={26} />
              </div>
              <div className="dashboard-title-text">
                <h1>Báo cáo & Tổng quan (Dashboard)</h1>
                <p>
                  Thống kê hiệu suất và tiến độ yêu cầu phần mềm chuẩn Agile — {currentMonthDisplay}
                </p>
              </div>
            </div>

            <div className="dashboard-controls">
              {/* Dropdown lọc theo dự án */}
              <div className="dashboard-select-wrapper">
                <select
                  value={selectedProjectId}
                  onChange={handleProjectChange}
                  className="dashboard-select"
                  id="dashboard-project-filter"
                  aria-label="Chọn dự án lọc"
                >
                  <option value="">Tất cả dự án ({projects.length})</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.project_key ? `[${p.project_key}]` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="dashboard-select-chevron" />
              </div>

              {/* Nút làm mới dữ liệu */}
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="btn-refresh"
                id="dashboard-refresh-btn"
                title="Làm mới số liệu"
              >
                <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
                <span>{refreshing ? 'Đang cập nhật...' : 'Làm mới'}</span>
              </button>
            </div>
          </div>

          {/* Banner thông báo lỗi nếu có */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={18} className="alert-icon" />
              <div style={{ flex: 1 }}>
                <span>{error}</span>
              </div>
              <button
                onClick={() => fetchDashboardData()}
                className="btn btn-sm btn-outline"
                style={{ marginLeft: '1rem' }}
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div className="loading-container" style={{ padding: '4rem 0' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                Đang tổng hợp dữ liệu thống kê PostgreSQL...
              </p>
            </div>
          ) : (
            <>
              {/* THẺ TỔNG QUAN CHỈ SỐ (SUMMARY CARDS) */}
              <div className="summary-cards-grid">
                {/* 1. Tổng dự án */}
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-label">Dự án được cấp quyền</span>
                    <div className="metric-icon-badge icon-projects">
                      <FolderGit2 size={18} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-value-large">
                      {summary?.totalProjects ?? 0}
                    </span>
                    <span className="metric-sub-badge">Workspaces</span>
                  </div>
                </div>

                {/* 2. Tổng Epics */}
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-label">Tổng số Epic</span>
                    <div className="metric-icon-badge icon-epics">
                      <Bookmark size={18} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-value-large">
                      {summary?.totalEpics ?? 0}
                    </span>
                    <span className="metric-sub-badge highlight">
                      +{summary?.epicsThisMonth ?? 0} tháng này
                    </span>
                  </div>
                </div>

                {/* 3. Tổng Stories */}
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-label">Tổng số Story</span>
                    <div className="metric-icon-badge icon-stories">
                      <BookOpen size={18} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-value-large">
                      {summary?.totalStories ?? 0}
                    </span>
                    <span className="metric-sub-badge highlight">
                      +{summary?.storiesThisMonth ?? 0} tháng này
                    </span>
                  </div>
                </div>

                {/* 4. Tổng Tasks / Sub-tasks */}
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-label">Tasks / Sub-tasks</span>
                    <div className="metric-icon-badge icon-tasks">
                      <CheckSquare size={18} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-value-large">
                      {summary?.totalTasks ?? 0}
                    </span>
                    <span className="metric-sub-badge highlight">
                      +{summary?.tasksThisMonth ?? 0} tháng này
                    </span>
                  </div>
                </div>

                {/* 5. Issue tạo trong tháng */}
                <div className="metric-card">
                  <div className="metric-card-header">
                    <span className="metric-card-label">Issue trong tháng này</span>
                    <div className="metric-icon-badge icon-month">
                      <Calendar size={18} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-value-large">
                      {summary?.issuesThisMonth ?? 0}
                    </span>
                    <span className="metric-sub-badge highlight">
                      {currentMonthDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* BANNER TỶ LỆ HOÀN THÀNH CÔNG VIỆC (COMPLETION RATE) */}
              <div className="completion-banner-card">
                <div className="completion-banner-content">
                  <div className="completion-info-left">
                    <div className="completion-badge">
                      <Activity size={14} />
                      <span>Tiến độ thực hiện dự án</span>
                    </div>
                    <h3>Tỷ lệ hoàn thành công việc tổng thể</h3>
                    <p className="completion-formula-note">
                      Công thức: <code>(Số issue Done ÷ Tổng số issue) × 100%</code>. Mẫu số
                      được tính trên toàn bộ <strong>{summary?.totalIssues ?? 0}</strong> issue
                      thuộc phạm vi dự án hiện tại (bao gồm cả To Do, In Progress và Done).
                    </p>
                  </div>

                  <div className="completion-stats-right">
                    <div className="completion-percent-display">
                      <div className="completion-percent-number">
                        {summary?.completionRate ?? 0}%
                      </div>
                      <div className="completion-fraction">
                        Đã đóng <strong>{summary?.statusDistribution?.done ?? 0}</strong> /{' '}
                        {summary?.totalIssues ?? 0} issues
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div className="completion-progress-track">
                  <div
                    className="completion-progress-fill"
                    style={{ width: `${Math.min(100, summary?.completionRate || 0)}%` }}
                  ></div>
                </div>
              </div>

              {/* EMPTY STATE KHI CHƯA CÓ DỮ LIỆU ISSUE */}
              {summary?.totalIssues === 0 ? (
                <div className="dashboard-empty-card">
                  <div className="empty-icon-wrap">
                    <Sparkles size={32} />
                  </div>
                  <h3>Chưa ghi nhận Issue nào trong hệ thống</h3>
                  <p>
                    Hệ thống chưa có Epic, Story hoặc Task nào được đồng bộ. Bạn hãy vào mục{' '}
                    <strong>Dự án</strong> để phân tích yêu cầu bằng AI (Flow 5) hoặc đẩy lên Jira (Flow 7)!
                  </p>
                  <div className="empty-actions">
                    <Link to="/projects" className="btn btn-primary">
                      <FolderGit2 size={16} />
                      <span>Đi tới Danh sách Dự án</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* HÀNG BIỂU ĐỒ 1: CỘT PHÂN BỐ VÀ TRÒN TRẠNG THÁI */
                <>
                  <div className="charts-grid-row">
                    {/* Biểu đồ Cột: Epic, Story, Task trong tháng & toàn thời gian */}
                    <div className="chart-card">
                      <div className="chart-card-header">
                        <div>
                          <h3>Phân loại Issue (Epic, Story, Task)</h3>
                          <p>So sánh số lượng tạo trong tháng hiện tại và toàn thời gian</p>
                        </div>
                      </div>

                      <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={breakdownChartData}
                            margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                              dataKey="name"
                              stroke="#94a3b8"
                              fontSize={12}
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              fontSize={12}
                              tickLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip content={<CustomChartTooltip />} />
                            <Legend
                              wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                            />
                            <Bar
                              dataKey="Tháng này"
                              fill="#6366f1"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={45}
                            />
                            <Bar
                              dataKey="Toàn thời gian"
                              fill="#38bdf8"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={45}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Biểu đồ Tròn: Phân bố Trạng thái To Do, In Progress, Done */}
                    <div className="chart-card">
                      <div className="chart-card-header">
                        <div>
                          <h3>Phân bố Trạng thái (Status Distribution)</h3>
                          <p>Tỷ lệ các issue theo To Do, In Progress và Done</p>
                        </div>
                      </div>

                      <div className="chart-wrapper">
                        {statusPieData.length === 0 ? (
                          <div
                            style={{
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Chưa có dữ liệu trạng thái
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={95}
                                paddingAngle={4}
                                dataKey="count"
                                nameKey="label"
                              >
                                {statusPieData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color || '#6366f1'}
                                    stroke="rgba(10, 13, 20, 0.8)"
                                    strokeWidth={2}
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      {/* Legend pills */}
                      <div className="status-pills-row">
                        {statusDist?.distribution?.map((item) => (
                          <div key={item.status} className="status-pill-item">
                            <span
                              className="status-dot"
                              style={{ backgroundColor: item.color }}
                            ></span>
                            <span className="status-pill-label">{item.status}:</span>
                            <span className="status-pill-count">
                              {item.count} ({item.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* HÀNG BIỂU ĐỒ 2: LỊCH SỬ TẠO ISSUE THEO NGÀY TRONG THÁNG */}
                  <div className="chart-card" style={{ marginBottom: '2rem' }}>
                    <div className="chart-card-header">
                      <div>
                        <h3>Lịch sử tạo Issue theo ngày trong tháng</h3>
                        <p>
                          Biểu đồ đường thể hiện số lượng Epic, Story, Task được khởi tạo theo từng ngày
                          trong {currentMonthDisplay}
                        </p>
                      </div>
                      <div className="metric-sub-badge highlight">
                        Tổng: {trend?.totalInMonth ?? 0} issues
                      </div>
                    </div>

                    <div className="chart-wrapper" style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trendChartData}
                          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            dataKey="display_date"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip content={<CustomChartTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            name="Tổng Issue"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorTotal)"
                          />
                          <Line
                            type="monotone"
                            dataKey="epics"
                            name="Epic"
                            stroke="#a78bfa"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="stories"
                            name="Story"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="tasks"
                            name="Task"
                            stroke="#fbbf24"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {/* KHÔNG GIAN DỰ ÁN & BẢO MẬT HỆ THỐNG */}
              <div className="grid-2-col">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <FolderGit2 className="card-icon text-primary" size={20} />
                      <h3>Dự án gần đây</h3>
                    </div>
                    <Link to="/projects" className="btn btn-sm btn-outline">
                      Xem tất cả
                    </Link>
                  </div>
                  <div className="card-body">
                    {projects.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>Chưa có dự án nào.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {projects.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.65rem 0.85rem',
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Mã Jira: <code>{p.project_key || 'KAN'}</code>
                              </div>
                            </div>
                            <Link
                              to={`/projects/${p.id}`}
                              className="btn btn-sm btn-outline"
                              style={{ padding: '0.35rem 0.65rem' }}
                            >
                              <span>Chi tiết</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <Database className="card-icon text-accent" size={20} />
                      <h3>Hạ tầng & Tiến độ các luồng</h3>
                    </div>
                  </div>
                  <div className="card-body">
                    <ul className="status-checklist">
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 1: Xác thực JWT & PostgreSQL <code>users</code> table</span>
                      </li>
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 2: Workspace Management & <code>projects</code> table</span>
                      </li>
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 3: Cấu hình tích hợp & Mã hóa AES-256</span>
                      </li>
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 4–6: n8n AI Requirement Analyzer (Gemini)</span>
                      </li>
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 7–8: Push to Jira Cloud & Phân công thành viên</span>
                      </li>
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 9: 2-Way Webhook Sync & Kanban Board</span>
                      </li>
                      <li className="status-item done">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Flow 10: Dashboard Thống kê & Báo cáo số liệu hoàn tất</span>
                      </li>
                    </ul>

                    {lastUpdated && (
                      <div
                        style={{
                          marginTop: '1rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          textAlign: 'right',
                        }}
                      >
                        Dữ liệu cập nhật lúc: {formatTime(lastUpdated)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
