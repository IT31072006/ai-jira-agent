const db = require('../config/db');

class SnapshotModel {
  /**
   * Lưu hoặc cập nhật bản snapshot theo cặp (project_id, snapshot_date)
   * Đảm bảo tính Idempotency: không tạo bản ghi trùng lặp trong cùng 1 ngày
   */
  static async upsert({
    projectId,
    userId,
    snapshotDate,
    calculatedAt = new Date().toISOString(),
    totalIssues = 0,
    toDoIssues = 0,
    inProgressIssues = 0,
    doneIssues = 0,
    completionRate = 0,
    storyPoints = null,
    completedStoryPoints = null,
    executionStatus = 'SUCCESS',
    jobId,
    summaryData = {},
    statusDistribution = {},
    breakdownData = {},
    trendData = [],
    completionMetrics = {},
    fluctuations = {},
  }) {
    const query = `
      INSERT INTO project_analytics_snapshots (
        project_id,
        user_id,
        snapshot_date,
        calculated_at,
        total_issues,
        to_do_issues,
        in_progress_issues,
        done_issues,
        completion_rate,
        story_points,
        completed_story_points,
        execution_status,
        job_id,
        summary_data,
        status_distribution,
        breakdown_data,
        trend_data,
        completion_metrics,
        fluctuations,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP
      )
      ON CONFLICT (project_id, snapshot_date) DO UPDATE SET
        calculated_at = EXCLUDED.calculated_at,
        total_issues = EXCLUDED.total_issues,
        to_do_issues = EXCLUDED.to_do_issues,
        in_progress_issues = EXCLUDED.in_progress_issues,
        done_issues = EXCLUDED.done_issues,
        completion_rate = EXCLUDED.completion_rate,
        story_points = EXCLUDED.story_points,
        completed_story_points = EXCLUDED.completed_story_points,
        execution_status = EXCLUDED.execution_status,
        job_id = EXCLUDED.job_id,
        summary_data = EXCLUDED.summary_data,
        status_distribution = EXCLUDED.status_distribution,
        breakdown_data = EXCLUDED.breakdown_data,
        trend_data = EXCLUDED.trend_data,
        completion_metrics = EXCLUDED.completion_metrics,
        fluctuations = EXCLUDED.fluctuations,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      projectId,
      userId,
      snapshotDate,
      calculatedAt,
      totalIssues,
      toDoIssues,
      inProgressIssues,
      doneIssues,
      completionRate,
      storyPoints,
      completedStoryPoints,
      executionStatus,
      jobId,
      JSON.stringify(summaryData),
      JSON.stringify(statusDistribution),
      JSON.stringify(breakdownData),
      JSON.stringify(trendData),
      JSON.stringify(completionMetrics),
      JSON.stringify(fluctuations),
    ];

    const { rows } = await db.query(query, values);
    return rows[0];
  }

  /**
   * Lấy snapshot mới nhất của dự án
   */
  static async findLatestByProjectId(projectId) {
    const query = `
      SELECT *
      FROM project_analytics_snapshots
      WHERE project_id = $1
      ORDER BY snapshot_date DESC, calculated_at DESC
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [projectId]);
    return rows[0] || null;
  }

  /**
   * Lấy snapshot liền kề trước một ngày cụ thể (để tính toán biến động)
   */
  static async findPreviousByProjectId(projectId, beforeDate) {
    const query = `
      SELECT *
      FROM project_analytics_snapshots
      WHERE project_id = $1 AND snapshot_date < $2
      ORDER BY snapshot_date DESC
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [projectId, beforeDate]);
    return rows[0] || null;
  }

  /**
   * Lấy lịch sử snapshots theo khoảng thời gian để hiển thị biểu đồ diễn tiến
   */
  static async findByProjectId(projectId, { limit = 30, startDate = null, endDate = null } = {}) {
    let whereClause = 'WHERE project_id = $1';
    const params = [projectId];

    if (startDate) {
      params.push(startDate);
      whereClause += ` AND snapshot_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      whereClause += ` AND snapshot_date <= $${params.length}`;
    }

    params.push(limit);
    const query = `
      SELECT *
      FROM project_analytics_snapshots
      ${whereClause}
      ORDER BY snapshot_date DESC
      LIMIT $${params.length};
    `;

    const { rows } = await db.query(query, params);
    return rows;
  }

  /**
   * Kiểm tra xem ngày hôm nay dự án đã có snapshot hay chưa
   */
  static async existsForDate(projectId, snapshotDate) {
    const query = `
      SELECT id, snapshot_date, calculated_at, execution_status
      FROM project_analytics_snapshots
      WHERE project_id = $1 AND snapshot_date = $2
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [projectId, snapshotDate]);
    return rows[0] || null;
  }

  /**
   * Lấy lịch sử snapshots của tất cả dự án thuộc về người dùng, gom nhóm theo snapshot_date
   */
  static async findByUserId(userId, { limit = 30 } = {}) {
    const query = `
      SELECT 
        snapshot_date,
        MAX(calculated_at) as calculated_at,
        SUM(total_issues)::int as total_issues,
        SUM(to_do_issues)::int as to_do_issues,
        SUM(in_progress_issues)::int as in_progress_issues,
        SUM(done_issues)::int as done_issues,
        ROUND(
          CASE WHEN SUM(total_issues) > 0 
               THEN (SUM(done_issues)::numeric / SUM(total_issues)::numeric) * 100 
               ELSE 0 
          END, 2
        )::numeric as completion_rate,
        SUM(story_points) as story_points,
        SUM(completed_story_points) as completed_story_points,
        COUNT(DISTINCT project_id)::int as projects_count
      FROM project_analytics_snapshots
      WHERE user_id = $1
      GROUP BY snapshot_date
      ORDER BY snapshot_date DESC
      LIMIT $2;
    `;
    const { rows } = await db.query(query, [userId, limit]);
    return rows;
  }

  /**
   * Lấy snapshot mới nhất kèm phân tích biến động cho toàn bộ dự án của người dùng
   */
  static async findLatestByUserId(userId) {
    const snapshots = await this.findByUserId(userId, { limit: 2 });
    if (!snapshots || snapshots.length === 0) return null;
    const latest = snapshots[0];
    const previous = snapshots.length > 1 ? snapshots[1] : null;

    let narrative = 'Đây là bản snapshot đầu tiên của toàn bộ dự án.';
    let fluctuations = {
      hasPreviousSnapshot: false,
      baselineDate: null,
      totalIssuesChange: 0,
      doneIssuesChange: 0,
      inProgressIssuesChange: 0,
      toDoIssuesChange: 0,
      completionRateChange: 0,
      narrative,
    };

    if (previous) {
      const totalChange = latest.total_issues - previous.total_issues;
      const doneChange = latest.done_issues - previous.done_issues;
      const inProgressChange = latest.in_progress_issues - previous.in_progress_issues;
      const toDoChange = latest.to_do_issues - previous.to_do_issues;
      const rateChange = parseFloat((Number(latest.completion_rate) - Number(previous.completion_rate)).toFixed(2));
      fluctuations = {
        hasPreviousSnapshot: true,
        baselineDate: previous.snapshot_date,
        totalIssuesChange: totalChange,
        doneIssuesChange: doneChange,
        inProgressIssuesChange: inProgressChange,
        toDoIssuesChange: toDoChange,
        completionRateChange: rateChange,
        narrative: `Tổng số công việc: ${totalChange > 0 ? '+' : ''}${totalChange}; Số công việc hoàn thành: ${doneChange > 0 ? '+' : ''}${doneChange}; Tỷ lệ hoàn thành: ${rateChange > 0 ? '+' : ''}${rateChange}%`,
      };
    }

    return {
      ...latest,
      fluctuations,
    };
  }
}

module.exports = SnapshotModel;

