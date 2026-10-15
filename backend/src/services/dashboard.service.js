const db = require('../config/db');
const ProjectModel = require('../models/project.model');

class DashboardService {
  /**
   * Xây dựng điều kiện WHERE và danh sách tham số để lọc issue thuộc quyền của user
   * @param {string} userId - UUID của user
   * @param {string} [projectId] - Tùy chọn: UUID của project cụ thể
   */
  static async getIssueScopeFilter(userId, projectId) {
    let project = null;
    let whereClause = '';
    const params = [userId];

    if (projectId) {
      project = await ProjectModel.findByIdAndUserId(projectId, userId);
      if (!project) {
        const err = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
        err.statusCode = 404;
        throw err;
      }

      const pKey = (project.project_key || ProjectModel.generateDefaultKey(project.name)).trim().toUpperCase();
      params.push(projectId, pKey);
      whereClause = `
        WHERE (
          j.project_id = $2
          OR (j.user_id = $1 AND UPPER(j.project_key) = $3)
          OR UPPER(j.project_key) = $3
        )
      `;
    } else {
      whereClause = `
        WHERE (
          j.user_id = $1
          OR j.project_id IN (SELECT id FROM projects WHERE user_id = $1)
          OR UPPER(j.project_key) IN (
            SELECT DISTINCT UPPER(COALESCE(project_key, '')) FROM projects WHERE user_id = $1 AND project_key IS NOT NULL AND project_key != ''
            UNION
            SELECT DISTINCT UPPER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) FROM projects WHERE user_id = $1
          )
        )
      `;
    }

    return { whereClause, params, project };
  }

  /**
   * GET /api/dashboard/summary
   * Tổng quan thống kê hệ thống theo quyền người dùng
   */
  static async getSummary({ userId, projectId }) {
    const { whereClause, params, project } = await this.getIssueScopeFilter(userId, projectId);

    // 1. Đếm tổng số dự án mà user có quyền truy cập
    const projectCountRes = await db.query(
      `SELECT COUNT(*)::int AS count FROM projects WHERE user_id = $1;`,
      [userId]
    );
    const totalProjects = projectCountRes.rows[0]?.count || 0;

    // 2. Thống kê tổng hợp số lượng issue bằng PostgreSQL
    const summaryQuery = `
      WITH scoped_issues AS (
        SELECT
          j.id,
          j.issue_key,
          j.created_at,
          CASE
            WHEN UPPER(j.issue_type) = 'EPIC' THEN 'Epic'
            WHEN UPPER(j.issue_type) IN ('STORY', 'USER STORY', 'USER_STORY') THEN 'Story'
            ELSE 'Task'
          END AS normalized_type,
          CASE
            WHEN UPPER(COALESCE(j.status_category, j.status)) IN ('DONE', 'CLOSED', 'RESOLVED', 'COMPLETED') THEN 'Done'
            WHEN UPPER(COALESCE(j.status_category, j.status)) IN ('IN PROGRESS', 'IN_PROGRESS', 'IN DEVELOPMENT', 'DOING', 'IN REVIEW') THEN 'In Progress'
            ELSE 'To Do'
          END AS normalized_status
        FROM jira_issues j
        ${whereClause}
      )
      SELECT
        COUNT(*)::int AS total_issues,
        COUNT(*) FILTER (WHERE normalized_type = 'Epic')::int AS total_epics,
        COUNT(*) FILTER (WHERE normalized_type = 'Story')::int AS total_stories,
        COUNT(*) FILTER (WHERE normalized_type = 'Task')::int AS total_tasks,
        
        -- Số lượng trong tháng hiện tại theo ranh giới [đầu tháng, đầu tháng kế tiếp)
        COUNT(*) FILTER (
          WHERE created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            AND created_at < DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
        )::int AS issues_this_month,
        
        COUNT(*) FILTER (
          WHERE normalized_type = 'Epic'
            AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            AND created_at < DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
        )::int AS epics_this_month,
        
        COUNT(*) FILTER (
          WHERE normalized_type = 'Story'
            AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            AND created_at < DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
        )::int AS stories_this_month,
        
        COUNT(*) FILTER (
          WHERE normalized_type = 'Task'
            AND created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            AND created_at < DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
        )::int AS tasks_this_month,

        -- Trạng thái
        COUNT(*) FILTER (WHERE normalized_status = 'Done')::int AS status_done,
        COUNT(*) FILTER (WHERE normalized_status = 'In Progress')::int AS status_in_progress,
        COUNT(*) FILTER (WHERE normalized_status = 'To Do')::int AS status_to_do
      FROM scoped_issues;
    `;

    const { rows } = await db.query(summaryQuery, params);
    const row = rows[0] || {};

    const totalIssues = row.total_issues || 0;
    const statusDone = row.status_done || 0;
    const statusInProgress = row.status_in_progress || 0;
    const statusToDo = row.status_to_do || 0;

    // Tỷ lệ hoàn thành: (Done / Total) * 100, bảo đảm không bị chia cho 0
    const completionRate = totalIssues > 0
      ? parseFloat(((statusDone / totalIssues) * 100).toFixed(1))
      : 0;

    // Lấy thông tin khoảng thời gian tháng hiện tại
    const timeWindowRes = await db.query(`
      SELECT
        DATE_TRUNC('month', CURRENT_TIMESTAMP) AS month_start,
        DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month' AS next_month_start,
        CURRENT_SETTING('TIMEZONE') AS db_timezone;
    `);
    const timeWindow = timeWindowRes.rows[0];

    return {
      totalProjects,
      totalEpics: row.total_epics || 0,
      totalStories: row.total_stories || 0,
      totalTasks: row.total_tasks || 0,
      totalIssues,
      issuesThisMonth: row.issues_this_month || 0,
      epicsThisMonth: row.epics_this_month || 0,
      storiesThisMonth: row.stories_this_month || 0,
      tasksThisMonth: row.tasks_this_month || 0,
      completionRate,
      statusDistribution: {
        toDo: statusToDo,
        inProgress: statusInProgress,
        done: statusDone,
      },
      timeWindow: {
        monthStart: timeWindow.month_start,
        nextMonthStart: timeWindow.next_month_start,
        timezone: timeWindow.db_timezone,
      },
      filteredProject: project ? {
        id: project.id,
        name: project.name,
        projectKey: project.project_key || ProjectModel.generateDefaultKey(project.name),
      } : null,
    };
  }

  /**
   * GET /api/dashboard/issue-breakdown
   * Phân loại số lượng Epic, Story, Task tạo trong tháng và toàn thời gian
   */
  static async getIssueBreakdown({ userId, projectId }) {
    const { whereClause, params } = await this.getIssueScopeFilter(userId, projectId);

    const breakdownQuery = `
      WITH scoped_issues AS (
        SELECT
          j.created_at,
          CASE
            WHEN UPPER(j.issue_type) = 'EPIC' THEN 'Epic'
            WHEN UPPER(j.issue_type) IN ('STORY', 'USER STORY', 'USER_STORY') THEN 'Story'
            ELSE 'Task'
          END AS normalized_type
        FROM jira_issues j
        ${whereClause}
      )
      SELECT
        normalized_type,
        COUNT(*)::int AS all_time_count,
        COUNT(*) FILTER (
          WHERE created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            AND created_at < DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
        )::int AS this_month_count
      FROM scoped_issues
      GROUP BY normalized_type;
    `;

    const { rows } = await db.query(breakdownQuery, params);
    const map = {
      Epic: { allTime: 0, thisMonth: 0 },
      Story: { allTime: 0, thisMonth: 0 },
      Task: { allTime: 0, thisMonth: 0 },
    };

    rows.forEach((r) => {
      if (map[r.normalized_type]) {
        map[r.normalized_type].allTime = r.all_time_count;
        map[r.normalized_type].thisMonth = r.this_month_count;
      }
    });

    const breakdown = [
      {
        type: 'Epic',
        name: 'Epics',
        thisMonth: map.Epic.thisMonth,
        allTime: map.Epic.allTime,
      },
      {
        type: 'Story',
        name: 'Stories',
        thisMonth: map.Story.thisMonth,
        allTime: map.Story.allTime,
      },
      {
        type: 'Task',
        name: 'Tasks / Sub-tasks',
        thisMonth: map.Task.thisMonth,
        allTime: map.Task.allTime,
      },
    ];

    return {
      breakdown,
      totals: {
        thisMonth: map.Epic.thisMonth + map.Story.thisMonth + map.Task.thisMonth,
        allTime: map.Epic.allTime + map.Story.allTime + map.Task.allTime,
      },
    };
  }

  /**
   * GET /api/dashboard/status-distribution
   * Phân bố trạng thái issue: To Do, In Progress, Done
   */
  static async getStatusDistribution({ userId, projectId }) {
    const { whereClause, params } = await this.getIssueScopeFilter(userId, projectId);

    const statusQuery = `
      WITH scoped_issues AS (
        SELECT
          CASE
            WHEN UPPER(COALESCE(j.status_category, j.status)) IN ('DONE', 'CLOSED', 'RESOLVED', 'COMPLETED') THEN 'Done'
            WHEN UPPER(COALESCE(j.status_category, j.status)) IN ('IN PROGRESS', 'IN_PROGRESS', 'IN DEVELOPMENT', 'DOING', 'IN REVIEW') THEN 'In Progress'
            ELSE 'To Do'
          END AS normalized_status
        FROM jira_issues j
        ${whereClause}
      )
      SELECT
        normalized_status,
        COUNT(*)::int AS count
      FROM scoped_issues
      GROUP BY normalized_status;
    `;

    const { rows } = await db.query(statusQuery, params);
    let done = 0;
    let inProgress = 0;
    let toDo = 0;

    rows.forEach((r) => {
      if (r.normalized_status === 'Done') done = r.count;
      else if (r.normalized_status === 'In Progress') inProgress = r.count;
      else if (r.normalized_status === 'To Do') toDo = r.count;
    });

    const total = done + inProgress + toDo;
    const completionRate = total > 0 ? parseFloat(((done / total) * 100).toFixed(1)) : 0;

    const distribution = [
      {
        status: 'To Do',
        label: 'Cần làm (To Do)',
        count: toDo,
        percentage: total > 0 ? parseFloat(((toDo / total) * 100).toFixed(1)) : 0,
        color: '#64748b', // Slate
      },
      {
        status: 'In Progress',
        label: 'Đang thực hiện (In Progress)',
        count: inProgress,
        percentage: total > 0 ? parseFloat(((inProgress / total) * 100).toFixed(1)) : 0,
        color: '#3b82f6', // Blue
      },
      {
        status: 'Done',
        label: 'Hoàn thành (Done)',
        count: done,
        percentage: total > 0 ? parseFloat(((done / total) * 100).toFixed(1)) : 0,
        color: '#10b981', // Emerald green
      },
    ];

    return {
      total,
      done,
      inProgress,
      toDo,
      completionRate,
      denominatorNote: 'Mẫu số tính tỷ lệ hoàn thành là tổng số Issue trong phạm vi truy cập (To Do + In Progress + Done)',
      distribution,
    };
  }

  /**
   * GET /api/dashboard/creation-trend
   * Lịch sử tạo issue theo ngày trong tháng hiện tại
   */
  static async getCreationTrend({ userId, projectId }) {
    const { whereClause, params } = await this.getIssueScopeFilter(userId, projectId);

    const trendQuery = `
      WITH days AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_TIMESTAMP)::date,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      scoped_issues AS (
        SELECT
          j.created_at,
          CASE
            WHEN UPPER(j.issue_type) = 'EPIC' THEN 'Epic'
            WHEN UPPER(j.issue_type) IN ('STORY', 'USER STORY', 'USER_STORY') THEN 'Story'
            ELSE 'Task'
          END AS normalized_type
        FROM jira_issues j
        ${whereClause}
      ),
      daily_counts AS (
        SELECT
          DATE(created_at) AS day,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE normalized_type = 'Epic')::int AS epics,
          COUNT(*) FILTER (WHERE normalized_type = 'Story')::int AS stories,
          COUNT(*) FILTER (WHERE normalized_type = 'Task')::int AS tasks
        FROM scoped_issues
        WHERE created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
          AND created_at < DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
        GROUP BY DATE(created_at)
      )
      SELECT
        TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
        TO_CHAR(d.day, 'DD/MM') AS display_date,
        COALESCE(c.total, 0)::int AS total,
        COALESCE(c.epics, 0)::int AS epics,
        COALESCE(c.stories, 0)::int AS stories,
        COALESCE(c.tasks, 0)::int AS tasks
      FROM days d
      LEFT JOIN daily_counts c ON d.day = c.day
      ORDER BY d.day ASC;
    `;

    const { rows } = await db.query(trendQuery, params);

    const totalInMonth = rows.reduce((sum, item) => sum + item.total, 0);

    return {
      month: new Date().toISOString().slice(0, 7), // YYYY-MM
      totalInMonth,
      trend: rows,
    };
  }
}

module.exports = DashboardService;
