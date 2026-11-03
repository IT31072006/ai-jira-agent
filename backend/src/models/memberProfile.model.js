const db = require('../config/db');

// Danh mục kỹ năng và các từ khóa nhận diện chuyên môn (Tiếng Việt & Tiếng Anh)
const SKILL_CATEGORIES = {
  frontend: {
    title: 'Frontend & UI/UX',
    keywords: [
      'ui', 'ux', 'giao diện', 'màn hình', 'frontend', 'css', 'html', 'react',
      'vue', 'component', 'responsive', 'modal', 'view', 'form', 'button',
      'svg', 'canvas', 'bản đồ', 'menu', 'hiển thị', 'animation', 'layout'
    ],
    tags: ['React', 'CSS', 'UI/UX Design', 'Responsive UI', 'Component Architecture']
  },
  backend: {
    title: 'Backend & CSDL API',
    keywords: [
      'api', 'backend', 'database', 'csdl', 'postgresql', 'sql', 'bảng', 'redis',
      'websocket', 'express', 'node', 'controller', 'service', 'model', 'cache',
      'crud', 'endpoint', 'server', 'migration', 'schema', 'truy vấn'
    ],
    tags: ['Node.js', 'Express', 'PostgreSQL', 'REST API', 'Database Design', 'Redis']
  },
  auth: {
    title: 'Bảo mật & Xác thực Auth',
    keywords: [
      'auth', 'xác thực', 'đăng ký', 'đăng nhập', 'mật khẩu', 'otp', 'jwt',
      'token', 'sso', 'google', 'facebook', 'oauth', 'quyền', 'phân quyền',
      'security', 'bảo mật', 'khôi phục'
    ],
    tags: ['JWT Auth', 'OAuth SSO', 'Password Security', 'OTP Verification']
  },
  payment: {
    title: 'Thanh toán & Tích hợp',
    keywords: [
      'thanh toán', 'payment', 'momo', 'zalopay', 'vnpay', 'cọc', 'tiền cọc',
      'checkout', 'banking', 'ngân hàng', 'hóa đơn', 'cổng thanh toán', 'tiền'
    ],
    tags: ['Payment Gateway', 'MoMo', 'ZaloPay', 'VNPay', 'Checkout Flow']
  },
  devops: {
    title: 'DevOps & Tự động hóa',
    keywords: [
      'devops', 'docker', 'deploy', 'ci/cd', 'n8n', 'webhook', 'cron', 'scheduler',
      'monitor', 'giám sát', 'triển khai', 'standup', 'watchdog', 'tự động'
    ],
    tags: ['n8n Automation', 'Webhooks', 'Docker', 'CI/CD Pipelines']
  },
  testing: {
    title: 'QA & Kiểm thử AI',
    keywords: [
      'test', 'kiểm thử', 'unit test', 'e2e', 'qa', 'qc', 'validation',
      'gemini', 'ai', 'prompt', 'báo cáo', 'phân tích dữ liệu', 'kpi'
    ],
    tags: ['Unit Testing', 'Gemini AI', 'Quality Assurance', 'Data Analysis']
  }
};

class MemberProfileModel {
  /**
   * Lấy danh sách hồ sơ thành viên theo userId và projectKey
   */
  static async findByUserId(userId, projectKey = null) {
    let query = 'SELECT * FROM jira_member_profiles WHERE user_id = $1';
    const params = [userId];

    if (projectKey && projectKey.trim()) {
      query += ' AND (project_key = $2 OR project_key IS NULL)';
      params.push(projectKey.trim().toUpperCase());
    }

    query += ' ORDER BY total_assigned_tasks DESC, display_name ASC';
    const res = await db.query(query, params);
    return res.rows;
  }

  /**
   * Tìm hồ sơ theo accountId
   */
  static async findByAccountId(userId, accountId) {
    const query = `
      SELECT * FROM jira_member_profiles 
      WHERE user_id = $1 AND account_id = $2
      LIMIT 1;
    `;
    const res = await db.query(query, [userId, accountId]);
    return res.rows[0] || null;
  }

  /**
   * Upsert một hồ sơ thành viên
   */
  static async upsert(userId, profile) {
    const query = `
      INSERT INTO jira_member_profiles (
        user_id, account_id, project_key, display_name, email, avatar_url,
        primary_strength, skill_tags, strength_scores, total_assigned_tasks, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, account_id) DO UPDATE SET
        project_key = COALESCE(EXCLUDED.project_key, jira_member_profiles.project_key),
        display_name = COALESCE(EXCLUDED.display_name, jira_member_profiles.display_name),
        email = COALESCE(EXCLUDED.email, jira_member_profiles.email),
        avatar_url = COALESCE(EXCLUDED.avatar_url, jira_member_profiles.avatar_url),
        primary_strength = COALESCE(EXCLUDED.primary_strength, jira_member_profiles.primary_strength),
        skill_tags = COALESCE(EXCLUDED.skill_tags, jira_member_profiles.skill_tags),
        strength_scores = COALESCE(EXCLUDED.strength_scores, jira_member_profiles.strength_scores),
        total_assigned_tasks = COALESCE(EXCLUDED.total_assigned_tasks, jira_member_profiles.total_assigned_tasks),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [
      userId,
      profile.accountId,
      profile.projectKey || null,
      profile.displayName,
      profile.emailAddress || profile.email || null,
      profile.avatarUrl || null,
      profile.primaryStrength || 'Fullstack Developer',
      JSON.stringify(profile.skillTags || profile.skills || []),
      JSON.stringify(profile.strengthScores || {}),
      profile.totalAssignedTasks || 0,
    ];
    const res = await db.query(query, values);
    return res.rows[0];
  }

  /**
   * Học hỏi từ các lần phân công: Cập nhật điểm mạnh và số task khi đẩy lên Jira
   * @param {string} userId
   * @param {string} projectKey
   * @param {Array<{ accountId, displayName, title, description }>} assignments
   */
  static async recordAssignments(userId, projectKey, assignments = []) {
    if (!Array.isArray(assignments) || assignments.length === 0) return;

    // Nhóm task theo accountId
    const byMember = {};
    for (const item of assignments) {
      if (!item.accountId) continue;
      if (!byMember[item.accountId]) {
        byMember[item.accountId] = {
          accountId: item.accountId,
          displayName: item.displayName || 'Thành viên',
          tasks: [],
        };
      }
      byMember[item.accountId].tasks.push(item);
    }

    for (const accountId of Object.keys(byMember)) {
      const memberData = byMember[accountId];
      let profile = await this.findByAccountId(userId, accountId);

      let scores = profile?.strength_scores || {
        frontend: 0, backend: 0, auth: 0, payment: 0, devops: 0, testing: 0
      };
      let totalTasks = (profile?.total_assigned_tasks || 0) + memberData.tasks.length;

      // Phân tích từ khóa của các task vừa được gán
      for (const t of memberData.tasks) {
        const text = `${t.title || ''} ${t.description || ''}`.toLowerCase();
        for (const [catKey, catDef] of Object.entries(SKILL_CATEGORIES)) {
          for (const kw of catDef.keywords) {
            if (text.includes(kw)) {
              scores[catKey] = (scores[catKey] || 0) + 1;
              break; // mỗi task chỉ cộng 1 điểm cho mỗi danh mục
            }
          }
        }
      }

      // Xác định thế mạnh vượt trội nhất (Primary Strength)
      let highestCat = 'backend';
      let highestScore = -1;
      for (const [catKey, score] of Object.entries(scores)) {
        if (score > highestScore) {
          highestScore = score;
          highestCat = catKey;
        }
      }

      const primaryStrength = SKILL_CATEGORIES[highestCat]?.title || 'Fullstack Developer';
      const skillTags = SKILL_CATEGORIES[highestCat]?.tags || ['Fullstack Engineering'];

      await this.upsert(userId, {
        accountId,
        projectKey,
        displayName: memberData.displayName,
        email: memberData.email || profile?.email,
        avatarUrl: memberData.avatarUrl || profile?.avatar_url,
        primaryStrength,
        skillTags,
        strengthScores: scores,
        totalAssignedTasks: totalTasks,
      });
    }
  }

  /**
   * Đồng bộ và học hỏi từ các issue đã lưu sẵn trong bảng jira_issues
   */
  static async syncFromJiraIssues(userId, projectKey) {
    try {
      const res = await db.query(
        `SELECT assignee, summary, description FROM jira_issues 
         WHERE (user_id = $1 OR project_key = $2) AND assignee IS NOT NULL`,
        [userId, projectKey ? projectKey.trim().toUpperCase() : '']
      );

      if (res.rows.length === 0) return;

      const issuesByAssignee = {};
      for (const row of res.rows) {
        if (!issuesByAssignee[row.assignee]) {
          issuesByAssignee[row.assignee] = [];
        }
        issuesByAssignee[row.assignee].push(row);
      }

      // Cập nhật điểm cho từng assignee tìm thấy
      const currentProfiles = await this.findByUserId(userId, projectKey);
      for (const [assigneeName, tasks] of Object.entries(issuesByAssignee)) {
        const matched = currentProfiles.find(
          (p) => p.display_name.toLowerCase().includes(assigneeName.toLowerCase()) ||
                 assigneeName.toLowerCase().includes(p.display_name.toLowerCase())
        );

        if (matched) {
          const fakeAssignments = tasks.map((t) => ({
            accountId: matched.account_id,
            displayName: matched.display_name,
            title: t.summary,
            description: t.description,
          }));
          await this.recordAssignments(userId, projectKey, fakeAssignments);
        }
      }
    } catch (e) {
      console.warn('[MemberProfileModel] Lỗi syncFromJiraIssues:', e.message);
    }
  }
}

MemberProfileModel.SKILL_CATEGORIES = SKILL_CATEGORIES;
module.exports = MemberProfileModel;
