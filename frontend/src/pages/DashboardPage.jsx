import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { projectApi } from '../api/projectApi';
import { dashboardApi } from '../api/dashboardApi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  LineChart,
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
  BarChart3,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Activity,
  Server,
  History,
  Clock,
  Play,
} from 'lucide-react';

// Custom Tooltip cho Recharts tương thích dark mode, memoized để tránh re-render thừa
const CustomChartTooltip = memo(({ active, payload, label }) => {
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
});

CustomChartTooltip.displayName = 'CustomChartTooltip';

export const DashboardPage = () => {
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

  // 1. Tải danh sách dự án (1 lần duy nhất khi mount)
  useEffect(() => {
    let isMounted = true;
    projectApi
      .getProjects()
      .then((res) => {
        if (isMounted) {
          setProjects(res.projects || []);
        }
      })
      .catch((err) => {
        console.error('Không thể tải danh sách dự án:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Tải toàn bộ dữ liệu thống kê từ Backend khi selectedProjectId thay đổi
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dashboardApi.getSummary(selectedProjectId || undefined),
      dashboardApi.getIssueBreakdown(selectedProjectId || undefined),
      dashboardApi.getStatusDistribution(selectedProjectId || undefined),
      dashboardApi.getCreationTrend(selectedProjectId || undefined),
    ])
      .then(([summaryRes, breakdownRes, statusRes, trendRes]) => {
        if (isMounted) {
          setSummary(summaryRes.data || null);
          setBreakdown(breakdownRes.data || null);
          setStatusDist(statusRes.data || null);
          setTrend(trendRes.data || null);
          setLastUpdated(new Date());
          setError('');
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Lỗi khi tải dữ liệu Dashboard:', err);
          setError(
            err?.response?.data?.message || 'Không thể tải dữ liệu thống kê. Vui lòng thử lại.'
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // Làm mới hoặc thử lại số liệu chủ động theo hành động của người dùng
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
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

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
  };

  // Memoize dữ liệu cho biểu đồ cột so sánh
  const breakdownChartData = useMemo(() => {
    return (
      breakdown?.breakdown?.map((item) => ({
        name: item.name,
        'Tháng này': item.thisMonth,
        'Toàn thời gian': item.allTime,
      })) || []
    );
  }, [breakdown]);

  // Memoize dữ liệu cho biểu đồ tròn trạng thái
  const statusPieData = useMemo(() => {
    return statusDist?.distribution?.filter((d) => d.count > 0) || [];
  }, [statusDist]);

  // Memoize dữ liệu cho biểu đồ đường xu hướng
  const trendChartData = useMemo(() => {
    return trend?.trend || [];
  }, [trend]);

  // State quản lý Lịch sử thống kê tự động (08:00 AM)
  const [historyDays, setHistoryDays] = useState(7);
  const [snapshots, setSnapshots] = useState([]);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [triggeringDaily, setTriggeringDaily] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Tải dữ liệu lịch sử snapshot
  const fetchHistoryData = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const [snapshotsRes, latestRes] = await Promise.all([
        dashboardApi.getSnapshots({
          projectId: selectedProjectId || undefined,
          days: historyDays,
        }),
        dashboardApi.getLatestSnapshot(selectedProjectId || undefined),
      ]);
      setSnapshots(snapshotsRes.data?.snapshots || []);
      setLatestSnapshot(latestRes.data?.snapshot || null);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử snapshot:', err);
      setHistoryError(err?.response?.data?.error || 'Không thể tải lịch sử thống kê.');
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedProjectId, historyDays]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dashboardApi.getSnapshots({
        projectId: selectedProjectId || undefined,
        days: historyDays,
      }),
      dashboardApi.getLatestSnapshot(selectedProjectId || undefined),
    ])
      .then(([snapshotsRes, latestRes]) => {
        if (isMounted) {
          setSnapshots(snapshotsRes.data?.snapshots || []);
          setLatestSnapshot(latestRes.data?.snapshot || null);
          setHistoryError('');
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Lỗi khi tải lịch sử snapshot:', err);
          setHistoryError(err?.response?.data?.error || 'Không thể tải lịch sử thống kê.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setHistoryLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId, historyDays]);

  // Kích hoạt chạy thống kê thủ công theo yêu cầu (Chạy thử)
  const handleTriggerDaily = async () => {
    setTriggeringDaily(true);
    try {
      await dashboardApi.triggerDailyAnalytics(selectedProjectId || undefined);
      await fetchHistoryData();
    } catch (err) {
      console.error('Lỗi khi kích hoạt thống kê:', err);
      alert(err?.response?.data?.error || 'Không thể kích hoạt thống kê tự động.');
    } finally {
      setTriggeringDaily(false);
    }
  };

  // Memoize dữ liệu cho biểu đồ lịch sử snapshot theo ngày
  const snapshotChartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    return [...snapshots].reverse().map((s) => {
      const dateParts = String(s.snapshot_date).split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : s.snapshot_date;
      return {
        date: formattedDate,
        fullDate: s.snapshot_date,
        'To Do': Number(s.to_do_issues || 0),
        'In Progress': Number(s.in_progress_issues || 0),
        'Done': Number(s.done_issues || 0),
        'Tỷ lệ hoàn thành (%)': Number(s.completion_rate || 0),
        total: Number(s.total_issues || 0),
      };
    });
  }, [snapshots]);

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
                    <BarChart3 size={32} />
                  </div>
                  <h3>Chưa ghi nhận Issue nào trong hệ thống</h3>
                  <p>
                    Hệ thống chưa có Epic, Story hoặc Task nào được đồng bộ. Bạn hãy vào mục{' '}
                    <strong>Dự án</strong> để phân tích yêu cầu bằng AI hoặc đẩy lên Jira!
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
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
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
                          <ResponsiveContainer width="100%" height="100%" debounce={50}>
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
                      <ResponsiveContainer width="100%" height="100%" debounce={50}>
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

              {/* PHẦN LỊCH SỬ TIẾN ĐỘ THỐNG KÊ TỰ ĐỘNG (08:00 AM) */}
              <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                  <div className="card-title-group">
                    <History className="card-icon text-primary" size={22} />
                    <div>
                      <h3>Lịch sử tiến độ & Thống kê tự động (08:00 AM)</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Theo dõi biến động số lượng Issue và Tỷ lệ hoàn thành qua các bản snapshot định kỳ
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Bộ chọn 7 ngày / 30 ngày */}
                    <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '3px', border: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={() => setHistoryDays(7)}
                        className={`btn btn-sm ${historyDays === 7 ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        7 ngày qua
                      </button>
                      <button
                        onClick={() => setHistoryDays(30)}
                        className={`btn btn-sm ${historyDays === 30 ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        30 ngày qua
                      </button>
                    </div>

                    {/* Nút chạy thử thống kê ngay */}
                    <button
                      onClick={handleTriggerDaily}
                      disabled={triggeringDaily}
                      className="btn btn-sm btn-outline"
                      title="Kích hoạt thống kê và lưu snapshot ngay bây giờ (Chạy thử)"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
                    >
                      <Play size={13} className={triggeringDaily ? 'spin-icon' : ''} />
                      <span>{triggeringDaily ? 'Đang tạo snapshot...' : 'Chạy thống kê ngay'}</span>
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  {historyError && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #f87171', borderRadius: 'var(--radius-sm)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <AlertCircle size={16} />
                      <span>{historyError}</span>
                    </div>
                  )}

                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.75rem' }}></div>
                      <p>Đang tải dữ liệu lịch sử snapshot...</p>
                    </div>
                  ) : snapshots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
                      <Clock size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                      <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Chưa có bản ghi thống kê tự động</h4>
                      <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Hệ thống sẽ tự động quét và lưu snapshot lúc <strong>08:00 AM (Asia/Ho_Chi_Minh)</strong> mỗi ngày. Bạn cũng có thể bấm nút bên dưới để tạo bản snapshot đầu tiên ngay bây giờ.
                      </p>
                      <button
                        onClick={handleTriggerDaily}
                        disabled={triggeringDaily}
                        className="btn btn-primary btn-sm"
                      >
                        <Sparkles size={14} />
                        <span>{triggeringDaily ? 'Đang phân tích...' : 'Tạo snapshot ngay'}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Banner thông tin Snapshot gần nhất & Nhận xét biến động tiếng Việt */}
                      {latestSnapshot && (
                        <div
                          style={{
                            padding: '0.85rem 1rem',
                            marginBottom: '1.25rem',
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                                Snapshot {latestSnapshot.snapshot_date}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Ghi nhận lúc: {latestSnapshot.calculated_at ? `${new Date(latestSnapshot.calculated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${new Date(latestSnapshot.calculated_at).toLocaleDateString('vi-VN')})` : ''}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Chu kỳ tự động: 08:00 AM (Asia/Ho_Chi_Minh)
                            </span>
                          </div>

                          {latestSnapshot.fluctuations?.narrative && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Activity size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
                              <span>
                                <strong>Đánh giá biến động:</strong> {latestSnapshot.fluctuations.narrative}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3 Thẻ biến động Delta Cards */}
                      {latestSnapshot?.fluctuations && latestSnapshot.fluctuations.hasPreviousSnapshot && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              Biến động hoàn thành (Δ Done)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: latestSnapshot.fluctuations.doneIssuesChange >= 0 ? '#10b981' : '#ef4444' }}>
                                {latestSnapshot.fluctuations.doneIssuesChange > 0 ? `+${latestSnapshot.fluctuations.doneIssuesChange}` : latestSnapshot.fluctuations.doneIssuesChange}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>so với ngày trước</span>
                            </div>
                          </div>

                          <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              Biến động tỷ lệ hoàn thành (Δ Rate)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: latestSnapshot.fluctuations.completionRateChange >= 0 ? '#10b981' : '#ef4444' }}>
                                {latestSnapshot.fluctuations.completionRateChange > 0 ? `+${latestSnapshot.fluctuations.completionRateChange}%` : `${latestSnapshot.fluctuations.completionRateChange}%`}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>điểm phần trăm</span>
                            </div>
                          </div>

                          <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              Biến động phạm vi (Δ Total Issues)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3b82f6' }}>
                                {latestSnapshot.fluctuations.totalIssuesChange > 0 ? `+${latestSnapshot.fluctuations.totalIssuesChange}` : latestSnapshot.fluctuations.totalIssuesChange}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {latestSnapshot.fluctuations.totalIssuesChange > 0 ? 'công việc mới tạo' : 'công việc'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2 Biểu đồ lịch sử */}
                      <div className="charts-grid-row">
                        {/* Biểu đồ 1: Biến động To Do, In Progress, Done theo ngày */}
                        <div className="chart-card" style={{ marginBottom: 0 }}>
                          <div className="chart-card-header">
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Cơ cấu công việc theo ngày</h4>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Phân bố trạng thái To Do, In Progress và Done qua các bản snapshot
                              </p>
                            </div>
                          </div>
                          <div className="chart-wrapper" style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                              <BarChart data={snapshotChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
                                <Bar dataKey="To Do" fill="#64748b" stackId="status" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="In Progress" fill="#3b82f6" stackId="status" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Done" fill="#10b981" stackId="status" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Biểu đồ 2: Diễn tiến Tỷ lệ hoàn thành qua các ngày */}
                        <div className="chart-card" style={{ marginBottom: 0 }}>
                          <div className="chart-card-header">
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Diễn tiến Tỷ lệ hoàn thành (%)</h4>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Xu hướng hoàn thành dự án qua các ngày thống kê
                              </p>
                            </div>
                          </div>
                          <div className="chart-wrapper" style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                              <LineChart data={snapshotChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} unit="%" />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
                                <Line
                                  type="monotone"
                                  dataKey="Tỷ lệ hoàn thành (%)"
                                  stroke="#6366f1"
                                  strokeWidth={2.5}
                                  dot={{ r: 4, fill: '#6366f1' }}
                                  activeDot={{ r: 6 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

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
                      <Server className="card-icon text-accent" size={20} />
                      <h3>Trạng thái Dịch vụ & Kết nối</h3>
                    </div>
                    <Link to="/settings" className="btn btn-sm btn-outline">
                      Cài đặt tích hợp
                    </Link>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              display: 'inline-block',
                              boxShadow: '0 0 8px #10b981',
                            }}
                          ></span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              Jira Cloud REST API
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Đồng bộ 2 chiều (Epics, Stories, Tasks)
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                          Sẵn sàng
                        </span>
                      </div>

                      <div
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              display: 'inline-block',
                              boxShadow: '0 0 8px #10b981',
                            }}
                          ></span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              Google Gemini AI
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Phân tích yêu cầu phần mềm chuẩn Agile
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                          Hoạt động
                        </span>
                      </div>

                      <div
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              display: 'inline-block',
                              boxShadow: '0 0 8px #10b981',
                            }}
                          ></span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              Webhook Jira Cloud
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Lắng nghe cập nhật trạng thái thời gian thực
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                          Đang lắng nghe
                        </span>
                      </div>

                      <div
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              display: 'inline-block',
                              boxShadow: '0 0 8px #10b981',
                            }}
                          ></span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              Cơ sở dữ liệu PostgreSQL
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Mã hóa bảo mật chuẩn AES-256-GCM
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                          Bảo mật
                        </span>
                      </div>
                    </div>

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
