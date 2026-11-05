const db = require('../config/db');
const env = require('../config/env');
const SnapshotModel = require('../models/snapshot.model');
const DailyJobModel = require('../models/daily-job.model');
const DashboardFlowService = require('./dashboard-flow.service');

class DailyAnalyticsService {
  /**
   * Lấy ngày hiện tại theo định dạng YYYY-MM-DD tại múi giờ Asia/Ho_Chi_Minh (GMT+7)
   */
  static getVietnamDate(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }

  /**
   * Tính toán biến động tiến độ giữa snapshot hiện tại và snapshot trước đó
   * @param {Object} current - Dữ liệu hôm nay
   * @param {Object|null} previous - Snapshot ngày trước (nếu có)
   */
  static calculateFluctuations(current, previous) {
    if (!previous) {
      return {
        hasPreviousSnapshot: false,
        baselineDate: null,
        totalIssuesChange: 0,
        doneIssuesChange: 0,
        inProgressIssuesChange: 0,
        toDoIssuesChange: 0,
        completionRateChange: 0,
        storyPointsChange: null,
        narrative: 'Đây là bản snapshot đầu tiên của dự án. Chưa có dữ liệu lịch sử đối chiếu.',
      };
    }

    const prevTotal = Number(previous.total_issues || 0);
    const prevDone = Number(previous.done_issues || 0);
    const prevInProgress = Number(previous.in_progress_issues || 0);
    const prevToDo = Number(previous.to_do_issues || 0);
    const prevRate = Number(previous.completion_rate || 0);

    const totalIssuesChange = current.totalIssues - prevTotal;
    const doneIssuesChange = current.doneIssues - prevDone;
    const inProgressIssuesChange = current.inProgressIssues - prevInProgress;
    const toDoIssuesChange = current.toDoIssues - prevToDo;
    const completionRateChange = parseFloat((current.completionRate - prevRate).toFixed(2));

    // Biến động Story Points (chỉ tính nếu CẢ HAI bản ghi đều có dữ liệu số thực sự)
    let storyPointsChange = null;
    const prevSP = previous.story_points !== null && previous.story_points !== undefined
      ? Number(previous.story_points)
      : null;

    if (current.storyPoints !== null && prevSP !== null && !isNaN(current.storyPoints) && !isNaN(prevSP)) {
      storyPointsChange = parseFloat((current.storyPoints - prevSP).toFixed(2));
    }

    // Phân biệt: số issue mới được tạo thêm vs số issue thực sự chuyển trạng thái
    const newIssuesCount = totalIssuesChange > 0 ? totalIssuesChange : 0;
    const completedDiff = doneIssuesChange;

    let narrativeParts = [];
    if (totalIssuesChange !== 0) {
      narrativeParts.push(`Tổng số công việc: ${totalIssuesChange > 0 ? '+' : ''}${totalIssuesChange} (${newIssuesCount > 0 ? `${newIssuesCount} task mới được bổ sung` : 'thu hẹp scope'})`);
    } else {
      narrativeParts.push('Tổng số công việc: không đổi (scope ổn định)');
    }

    if (completedDiff !== 0) {
      narrativeParts.push(`Số công việc hoàn thành: ${completedDiff > 0 ? '+' : ''}${completedDiff}`);
    }

    if (completionRateChange !== 0) {
      narrativeParts.push(`Tỷ lệ hoàn thành: ${completionRateChange > 0 ? '+' : ''}${completionRateChange}%`);
    }

    const narrative = narrativeParts.join('; ') || 'Tiến độ dự án không có biến động so với ngày trước.';

    return {
      hasPreviousSnapshot: true,
      baselineDate: previous.snapshot_date,
      totalIssuesChange,
      doneIssuesChange,
      inProgressIssuesChange,
      toDoIssuesChange,
      completionRateChange,
      storyPointsChange,
      hasStoryPointsComparison: storyPointsChange !== null,
      newIssuesCount,
      narrative,
    };
  }

  /**
   * Lấy danh sách các dự án hợp lệ được cấu hình chạy thống kê định kỳ
   */
  static async getEligibleProjects() {
    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.name,
        p.project_key,
        p.created_at,
        u.email AS user_email
      FROM projects p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  /**
   * Chạy thống kê tự động cho một dự án cụ thể
   */
  static async processProjectDailyAnalytics(project, { snapshotDate, jobId, forceRefresh = true }) {
    const projectId = project.id;
    const userId = project.user_id;

    // 1. Kiểm tra snapshot trùng ngày ngoài ý muốn nếu không forceRefresh
    if (!forceRefresh) {
      const existing = await SnapshotModel.existsForDate(projectId, snapshotDate);
      if (existing) {
        return {
          projectId,
          projectName: project.name,
          snapshotDate,
          skipped: true,
          message: 'Dự án đã có snapshot thống kê cho ngày hôm nay, bỏ qua để chống xử lý trùng lặp.',
        };
      }
    }

    // 2. Gọi Flow 10 (thông qua DashboardFlowService)
    const analytics = await DashboardFlowService.fetchFromFlow10({
      userId,
      projectId,
    });

    if (!analytics || !analytics.summary) {
      throw new Error(`Flow 10 không trả về dữ liệu thống kê hợp lệ cho dự án "${project.name}" (ID: ${projectId})`);
    }

    const summary = analytics.summary;
    const metrics = analytics.completionMetrics || {};
    const statusDist = analytics.statusDistribution || {};
    const breakdown = analytics.breakdown || {};
    const trend = analytics.creationTrend || [];

    // Trích xuất các trường dữ liệu bắt buộc theo đặc tả Section VII
    const totalIssues = Number(summary.totalIssues !== undefined ? summary.totalIssues : (metrics.totalIssues || 0));
    const doneIssues = Number(statusDist.done !== undefined ? statusDist.done : (metrics.doneIssues || 0));
    const inProgressIssues = Number(statusDist.inProgress !== undefined ? statusDist.inProgress : (metrics.inProgressIssues || 0));
    const toDoIssues = Number(statusDist.toDo !== undefined ? statusDist.toDo : (metrics.toDoIssues || 0));
    const completionRate = Number(metrics.completionRate !== undefined ? metrics.completionRate : (summary.completionRate || 0));

    // Xử lý Story Points: không tự suy diễn 5 SP/Story hay 2 SP/Task
    let storyPoints = null;
    let completedStoryPoints = null;
    if (metrics.hasStoryPointsData && metrics.totalStoryPoints !== null && metrics.totalStoryPoints !== undefined) {
      storyPoints = Number(metrics.totalStoryPoints);
      completedStoryPoints = metrics.completedStoryPoints !== null ? Number(metrics.completedStoryPoints) : null;
    } else if (typeof summary.totalStoryPoints === 'number' && !isNaN(summary.totalStoryPoints)) {
      storyPoints = summary.totalStoryPoints;
    }

    // 3. Tìm snapshot ngày trước để tính biến động tiến độ
    const previousSnapshot = await SnapshotModel.findPreviousByProjectId(projectId, snapshotDate);
    const fluctuations = this.calculateFluctuations(
      { totalIssues, doneIssues, inProgressIssues, toDoIssues, completionRate, storyPoints },
      previousSnapshot
    );

    // 4. Lưu snapshot an toàn vào PostgreSQL qua Model (n8n không chạm DB)
    const savedSnapshot = await SnapshotModel.upsert({
      projectId,
      userId,
      snapshotDate,
      calculatedAt: new Date().toISOString(),
      totalIssues,
      toDoIssues,
      inProgressIssues,
      doneIssues,
      completionRate,
      storyPoints,
      completedStoryPoints,
      executionStatus: 'SUCCESS',
      jobId,
      summaryData: summary,
      statusDistribution: statusDist,
      breakdownData: breakdown,
      trendData: trend,
      completionMetrics: metrics,
      fluctuations,
    });

    return {
      projectId,
      projectName: project.name,
      projectKey: project.project_key,
      snapshotDate,
      totalIssues,
      doneIssues,
      completionRate,
      storyPoints,
      fluctuations,
      savedSnapshotId: savedSnapshot.id,
      success: true,
    };
  }

  /**
   * Kích hoạt toàn bộ luồng Daily Analytics (được gọi từ n8n Scheduler hoặc cron nội bộ)
   */
  static async runDailyAnalytics({
    triggerSource = 'N8N_FLOW_10_DAILY_SCHEDULE',
    timezone = 'Asia/Ho_Chi_Minh',
    reportDate = null,
    runId = null,
    forceRefresh = false,
  } = {}) {
    const startTime = Date.now();
    const snapshotDate = reportDate || this.getVietnamDate();
    const effectiveRunId = runId || `flow10-daily-${snapshotDate}-${Date.now()}`;

    // 0. Kiểm tra chống chạy trùng lặp phiên (Idempotency) nếu không forceRefresh
    if (!forceRefresh) {
      const existingJob = await DailyJobModel.findByRunId(effectiveRunId);
      if (existingJob && existingJob.status === 'completed') {
        console.log(`[DailyAnalyticsService] Job ${effectiveRunId} đã hoàn tất trước đó, bỏ qua chạy lại (Idempotency check).`);
        return {
          success: true,
          jobId: effectiveRunId,
          snapshotDate,
          skipped: true,
          message: 'Job đã hoàn thành trước đó cho ngày hôm nay, bỏ qua chạy lại.',
          job: existingJob,
        };
      }
    }

    console.log(`[DailyAnalyticsService] Bắt đầu chạy Daily Project Analytics lúc 08:00 (${timezone}) - Ngày: ${snapshotDate} (Job: ${effectiveRunId})`);

    // 1. Xác định các dự án hợp lệ
    const projects = await this.getEligibleProjects();
    console.log(`[DailyAnalyticsService] Tìm thấy ${projects.length} dự án hợp lệ cần xử lý thống kê.`);

    // 2. Ghi nhận job vào dashboard_daily_jobs với trạng thái running
    await DailyJobModel.create({
      reportDate: snapshotDate,
      runId: effectiveRunId,
      triggerSource,
      projectsTotal: projects.length,
      status: 'running',
    });

    const results = [];
    let succeededCount = 0;
    let failedCount = 0;
    const errors = [];

    // 3. Xử lý từng dự án một cách độc lập (Fault-tolerant: dự án này lỗi không ảnh hưởng dự án khác)
    for (const project of projects) {
      try {
        const res = await this.processProjectDailyAnalytics(project, {
          snapshotDate,
          jobId: effectiveRunId,
          forceRefresh,
        });
        results.push(res);
        succeededCount++;
      } catch (err) {
        console.error(`[DailyAnalyticsService] Thất bại khi xử lý dự án "${project.name}" (ID: ${project.id}):`, err.message);
        failedCount++;
        errors.push(`${project.name}: ${err.message}`);

        // Ghi nhận bản ghi lỗi cho dự án này
        try {
          await SnapshotModel.upsert({
            projectId: project.id,
            userId: project.user_id,
            snapshotDate,
            calculatedAt: new Date().toISOString(),
            totalIssues: 0,
            toDoIssues: 0,
            inProgressIssues: 0,
            doneIssues: 0,
            completionRate: 0,
            executionStatus: 'FAILED',
            jobId: effectiveRunId,
            summaryData: { error: err.message },
          });
        } catch (dbErr) {
          console.error('[DailyAnalyticsService] Lỗi khi lưu snapshot thất bại:', dbErr.message);
        }

        results.push({
          projectId: project.id,
          projectName: project.name,
          success: false,
          error: err.message,
        });
      }
    }

    const executionMs = Date.now() - startTime;
    const finalStatus = failedCount === 0 ? 'completed' : (succeededCount > 0 ? 'partial_failed' : 'failed');
    const errorSummary = errors.length > 0 ? errors.slice(0, 5).join('; ') : null;

    // 4. Cập nhật kết quả phiên chạy vào dashboard_daily_jobs
    await DailyJobModel.updateCompletion(effectiveRunId, {
      status: finalStatus,
      projectsSucceeded: succeededCount,
      projectsFailed: failedCount,
      errorSummary,
    });

    console.log(`[DailyAnalyticsService] Hoàn thành Daily Analytics: ${succeededCount} thành công, ${failedCount} thất bại trong ${executionMs}ms (Trạng thái: ${finalStatus}).`);

    return {
      success: finalStatus !== 'failed',
      jobId: effectiveRunId,
      snapshotDate,
      triggerSource,
      timezone,
      status: finalStatus,
      totalProjects: projects.length,
      succeeded: succeededCount,
      failed: failedCount,
      executionMs,
      results,
    };
  }

  /**
   * Lấy lịch sử snapshots của một dự án để theo dõi tiến độ
   */
  static async getProjectSnapshots(projectId, options = {}) {
    return await SnapshotModel.findByProjectId(projectId, options);
  }

  /**
   * Lấy snapshot mới nhất kèm biến động so sánh
   */
  static async getLatestSnapshotWithFluctuation(projectId) {
    const latest = await SnapshotModel.findLatestByProjectId(projectId);
    if (!latest) return null;
    return latest;
  }
}

module.exports = DailyAnalyticsService;

