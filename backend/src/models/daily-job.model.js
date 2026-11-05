const db = require('../config/db');

class DailyJobModel {
  /**
   * Tạo hoặc ghi nhận phiên chạy Daily Analytics mới
   */
  static async create({
    reportDate,
    runId,
    triggerSource = 'N8N_FLOW_10_DAILY_SCHEDULE',
    projectsTotal = 0,
    status = 'running',
  }) {
    const query = `
      INSERT INTO dashboard_daily_jobs (
        report_date,
        run_id,
        trigger_source,
        status,
        started_at,
        projects_total,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (run_id) DO UPDATE SET
        trigger_source = EXCLUDED.trigger_source,
        status = EXCLUDED.status,
        projects_total = EXCLUDED.projects_total,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [reportDate, runId, triggerSource, status, projectsTotal];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  /**
   * Tìm job theo runId (idempotency key)
   */
  static async findByRunId(runId) {
    const query = `SELECT * FROM dashboard_daily_jobs WHERE run_id = $1 LIMIT 1;`;
    const { rows } = await db.query(query, [runId]);
    return rows[0] || null;
  }

  /**
   * Cập nhật kết quả phiên chạy khi hoàn tất
   */
  static async updateCompletion(runId, {
    status = 'completed',
    projectsSucceeded = 0,
    projectsFailed = 0,
    errorSummary = null,
  }) {
    const query = `
      UPDATE dashboard_daily_jobs
      SET
        status = $1,
        finished_at = CURRENT_TIMESTAMP,
        projects_succeeded = $2,
        projects_failed = $3,
        error_summary = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE run_id = $5
      RETURNING *;
    `;
    const values = [status, projectsSucceeded, projectsFailed, errorSummary, runId];
    const { rows } = await db.query(query, values);
    return rows[0] || null;
  }

  /**
   * Lấy job gần nhất
   */
  static async findLatest() {
    const query = `SELECT * FROM dashboard_daily_jobs ORDER BY started_at DESC LIMIT 1;`;
    const { rows } = await db.query(query);
    return rows[0] || null;
  }

  /**
   * Lấy danh sách jobs theo khoảng ngày
   */
  static async findRecent(limit = 10) {
    const query = `SELECT * FROM dashboard_daily_jobs ORDER BY started_at DESC LIMIT $1;`;
    const { rows } = await db.query(query, [limit]);
    return rows;
  }
}

module.exports = DailyJobModel;

