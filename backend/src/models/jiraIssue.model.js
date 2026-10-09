const db = require('../config/db');

class JiraIssueModel {
  /**
   * Tạo mới hoặc cập nhật issue đồng bộ từ Jira
   * @param {Object} data
   */
  static async upsert({
    issueKey,
    issueId = null,
    projectKey,
    summary,
    description = null,
    issueType = 'Task',
    status = 'To Do',
    statusCategory = 'To Do',
    assignee = null,
    jiraUrl = null,
    userId = null,
    projectId = null,
    parentKey = null,
  }) {
    const query = `
      INSERT INTO jira_issues (
        issue_key, issue_id, project_key, summary, description,
        issue_type, status, status_category, assignee, jira_url, user_id, project_id, parent_key, last_synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (issue_key) DO UPDATE
      SET
        issue_id = COALESCE(EXCLUDED.issue_id, jira_issues.issue_id),
        summary = COALESCE(EXCLUDED.summary, jira_issues.summary),
        description = COALESCE(EXCLUDED.description, jira_issues.description),
        issue_type = COALESCE(EXCLUDED.issue_type, jira_issues.issue_type),
        status = EXCLUDED.status,
        status_category = COALESCE(EXCLUDED.status_category, jira_issues.status_category),
        assignee = COALESCE(EXCLUDED.assignee, jira_issues.assignee),
        jira_url = COALESCE(EXCLUDED.jira_url, jira_issues.jira_url),
        user_id = COALESCE(EXCLUDED.user_id, jira_issues.user_id),
        project_id = COALESCE(EXCLUDED.project_id, jira_issues.project_id),
        parent_key = COALESCE(EXCLUDED.parent_key, jira_issues.parent_key),
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      issueKey.trim().toUpperCase(),
      issueId,
      projectKey ? projectKey.trim().toUpperCase() : issueKey.split('-')[0],
      summary,
      description,
      issueType,
      status,
      statusCategory,
      assignee,
      jiraUrl,
      userId || null,
      projectId || null,
      parentKey ? parentKey.trim().toUpperCase() : null,
    ];

    const { rows } = await db.query(query, values);
    return rows[0];
  }

  /**
   * Cập nhật trạng thái của issue theo issueKey
   */
  static async updateStatus({ issueKey, status, statusCategory, assignee }) {
    const query = `
      UPDATE jira_issues
      SET
        status = $1,
        status_category = COALESCE($2, status_category),
        assignee = COALESCE($3, assignee),
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE issue_key = $4
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      status,
      statusCategory || status,
      assignee || null,
      issueKey.trim().toUpperCase(),
    ]);
    return rows[0] || null;
  }

  /**
   * Lấy issue theo key
   */
  static async findByKey(issueKey) {
    const query = `
      SELECT * FROM jira_issues
      WHERE issue_key = $1
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [issueKey.trim().toUpperCase()]);
    return rows[0] || null;
  }

  /**
   * Lấy danh sách issue theo projectKey
   */
  static async findByProjectKey(projectKey) {
    const query = `
      SELECT * FROM jira_issues
      WHERE project_key = $1
      ORDER BY last_synced_at DESC;
    `;
    const { rows } = await db.query(query, [projectKey.trim().toUpperCase()]);
    return rows;
  }

  /**
   * Lấy tất cả issue đồng bộ
   */
  static async findAll(limit = 100) {
    const query = `
      SELECT * FROM jira_issues
      ORDER BY last_synced_at DESC
      LIMIT $1;
    `;
    const { rows } = await db.query(query, [limit]);
    return rows;
  }

  /**
   * Xóa issue
   */
  static async deleteByKey(issueKey) {
    const query = `
      DELETE FROM jira_issues
      WHERE issue_key = $1
      RETURNING issue_key;
    `;
    const { rows } = await db.query(query, [issueKey.trim().toUpperCase()]);
    return rows[0] || null;
  }
  /**
   * Lấy danh sách issue phục vụ xuất tài liệu phân cấp (Luồng 12)
   */
  static async findByProjectForExport({ projectId, projectKey, userId }) {
    const query = `
      SELECT id, issue_key, issue_id, project_key, summary, description,
             issue_type, status, status_category, assignee, jira_url,
             parent_key, last_synced_at, created_at, updated_at
      FROM jira_issues
      WHERE (
        project_id = $1
        OR (project_key = $2 AND (user_id = $3 OR user_id IS NULL))
      )
      ORDER BY 
        CASE 
          WHEN LOWER(issue_type) = 'epic' THEN 1
          WHEN LOWER(issue_type) = 'story' THEN 2
          ELSE 3
        END ASC,
        created_at ASC,
        issue_key ASC;
    `;
    const { rows } = await db.query(query, [
      projectId || null,
      projectKey ? projectKey.trim().toUpperCase() : null,
      userId || null,
    ]);
    return rows;
  }
}

module.exports = JiraIssueModel;
