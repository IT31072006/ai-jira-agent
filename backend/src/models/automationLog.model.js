const db = require('../config/db');

class AutomationLogModel {
  static async create({
    userId,
    workflowId = 'flow-13-daily-standup',
    workflowName = 'AI Jira Agent - Flow 13 Daily Standup & Sprint Watchdog',
    triggerType = 'SCHEDULE',
    status = 'SUCCESS',
    issuesScanned = 0,
    issuesAtRisk = 0,
    executionMs = 0,
    summary = '',
    channel = 'discord',
    targetDestination = null,
    responseData = null,
  }) {
    const query = `
      INSERT INTO automation_execution_logs (
        user_id, workflow_id, workflow_name, trigger_type, status,
        issues_scanned, issues_at_risk, execution_ms, summary, channel,
        target_destination, response_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      userId,
      workflowId,
      workflowName,
      triggerType,
      status,
      issuesScanned,
      issuesAtRisk,
      executionMs,
      summary,
      channel,
      targetDestination,
      responseData ? JSON.stringify(responseData) : null,
    ]);
    return rows[0];
  }

  static async getHistoryByUserId(userId, limit = 20) {
    const query = `
      SELECT id, user_id, workflow_id, workflow_name, trigger_type, status,
             issues_scanned, issues_at_risk, execution_ms, summary, channel,
             target_destination, response_data, created_at
      FROM automation_execution_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const { rows } = await db.query(query, [userId, limit]);
    return rows;
  }
}

module.exports = AutomationLogModel;
