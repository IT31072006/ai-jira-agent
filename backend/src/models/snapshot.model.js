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
}

module.exports = SnapshotModel;

