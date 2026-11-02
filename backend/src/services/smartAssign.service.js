const MemberProfileModel = require('../models/memberProfile.model');

class SmartAssignService {
  /**
   * Làm giàu danh sách thành viên với thế mạnh và lịch sử đã học từ CSDL
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.projectKey]
   * @param {Array} params.rawMembers
   */
  static async enrichMembersWithStrengths({ userId, projectKey, rawMembers = [] }) {
    // 1. Đồng bộ lịch sử từ jira_issues nếu có
    await MemberProfileModel.syncFromJiraIssues(userId, projectKey);

    // 2. Lấy hồ sơ từ bảng jira_member_profiles
    const profiles = await MemberProfileModel.findByUserId(userId, projectKey);
    const profileMap = new Map();
    profiles.forEach((p) => {
      profileMap.set(p.account_id, p);
      if (p.display_name) {
        profileMap.set(p.display_name.trim().toLowerCase(), p);
      }
    });

    // 3. Ghép thông tin thế mạnh vào từng thành viên
    const enriched = rawMembers.map((m, index) => {
      const p =
        profileMap.get(m.accountId) ||
        profileMap.get((m.displayName || '').trim().toLowerCase());

      const fallbackRoles = [
        {
          role: 'Backend & CSDL API',
          skills: ['Node.js', 'PostgreSQL', 'Express', 'Database Architecture'],
          scores: { backend: 10, auth: 5, frontend: 2, payment: 3, devops: 4, testing: 2 },
          recom: 'Khuyến nghị ưu tiên: Thiết kế CSDL, API Backend, Quản lý Token & Logic hệ thống',
        },
        {
          role: 'Frontend & UI/UX',
          skills: ['React', 'CSS', 'UI Components', 'Responsive', 'State Management'],
          scores: { frontend: 12, backend: 2, auth: 3, payment: 2, devops: 1, testing: 3 },
          recom: 'Khuyến nghị ưu tiên: Giao diện người dùng, Tương tác màn hình & Hiệu ứng trực quan',
        },
        {
          role: 'Thanh toán & DevOps Automation',
          skills: ['Payment Gateway', 'MoMo', 'ZaloPay', 'n8n Automation', 'Docker'],
          scores: { payment: 9, devops: 8, backend: 5, frontend: 2, auth: 4, testing: 2 },
          recom: 'Khuyến nghị ưu tiên: Cổng thanh toán, Tích hợp Webhook & Luồng tự động hóa',
        },
        {
          role: 'QA & AI Data Processing',
          skills: ['Unit Testing', 'Gemini AI', 'Quality Assurance', 'Data Analysis'],
          scores: { testing: 10, devops: 3, backend: 4, frontend: 3, auth: 2, payment: 1 },
          recom: 'Khuyến nghị ưu tiên: Kiểm thử chức năng, Phân tích dữ liệu & Tích hợp Gemini AI',
        },
      ];

      const defaultRole = fallbackRoles[index % fallbackRoles.length];

      const primaryStrength = p?.primary_strength || m.assignedRole || defaultRole.role;
      const skillTags = (p?.skill_tags && p.skill_tags.length > 0) ? p.skill_tags : (m.coreSkills || defaultRole.skills);
      const strengthScores = p?.strength_scores || defaultRole.scores;
      const totalAssigned = p?.total_assigned_tasks || 0;

      let aiRecommendation = m.aiSmartRecommendation || defaultRole.recom;
      if (primaryStrength.includes('Backend') || primaryStrength.includes('CSDL')) {
        aiRecommendation = 'Thế mạnh Backend & CSDL: Ưu tiên xử lý API, Truy vấn dữ liệu, Logic nghiệp vụ';
      } else if (primaryStrength.includes('Frontend') || primaryStrength.includes('UI')) {
        aiRecommendation = 'Thế mạnh Frontend & UI: Ưu tiên thiết kế giao diện, Component React, Trải nghiệm người dùng';
      } else if (primaryStrength.includes('Thanh toán') || primaryStrength.includes('DevOps')) {
        aiRecommendation = 'Thế mạnh Thanh toán & DevOps: Ưu tiên cổng MoMo/VNPay/ZaloPay, Webhook & Tự động hóa';
      } else if (primaryStrength.includes('QA') || primaryStrength.includes('Kiểm thử')) {
        aiRecommendation = 'Thế mạnh QA & Testing: Ưu tiên kiểm thử đơn vị, Xác thực luồng và Đảm bảo chất lượng';
      }

      return {
        ...m,
        primaryStrength,
        skillTags,
        strengthScores,
        totalAssignedTasks: totalAssigned,
        aiSmartRecommendation: aiRecommendation,
        badgeLabel: `${m.displayName} (${primaryStrength})`,
      };
    });

    return enriched;
  }

  /**
   * Phân tích ngữ cảnh kỹ thuật của text (Story/Task)
   * @param {string} text
   * @returns {Object} Điểm theo từng danh mục kỹ thuật
   */
  static analyzeTaskContext(text = '') {
    const lower = text.toLowerCase();
    const categories = MemberProfileModel.SKILL_CATEGORIES;
    const scores = {
      frontend: 0,
      backend: 0,
      auth: 0,
      payment: 0,
      devops: 0,
      testing: 0,
    };

    for (const [catKey, catDef] of Object.entries(categories)) {
      for (const kw of catDef.keywords) {
        if (lower.includes(kw)) {
          scores[catKey] += 1;
        }
      }
    }

    return scores;
  }

  /**
   * Thuật toán phân công thông minh:
   * 1. Gom nhóm các task liên quan trong cùng Story cho cùng 1 Dev (Chống conflict merge code).
   * 2. Học hỏi và ghép đúng thế mạnh của từng thành viên (Skill & Strength Profiling).
   * 3. Cân bằng khối lượng công việc (Workload Balancing).
   * 
   * @param {Object} params
   * @param {Array} params.epics - Cây phân rã Epics -> Stories -> Tasks
   * @param {Array} params.members - Danh sách thành viên Jira đã làm giàu thế mạnh
   * @param {string} [params.projectKey]
   * @param {string} [params.userId]
   */
  static autoAssign({ epics = [], members = [], projectKey = '', userId = '' }) {
    if (!Array.isArray(epics) || epics.length === 0) {
      return { epics: [], stats: {}, rationaleSummary: 'Chưa có Epics nào để phân công.' };
    }
    if (!Array.isArray(members) || members.length === 0) {
      return { epics, stats: {}, rationaleSummary: 'Chưa có danh sách thành viên để phân công.' };
    }

    // Workload tracker: đếm số task và story được gán cho từng accountId trong đợt này
    const workloadTracker = {};
    members.forEach((m) => {
      workloadTracker[m.accountId] = 0;
    });

    const assignedEpics = JSON.parse(JSON.stringify(epics)); // deep clone
    let totalAssignedStories = 0;
    let totalAssignedTasks = 0;

    assignedEpics.forEach((epic, epicIdx) => {
      if (!Array.isArray(epic.stories)) return;

      epic.stories.forEach((story, storyIdx) => {
        // Gom nội dung Story + toàn bộ Task con để xác định domain chuyên môn trọn vẹn
        let combinedText = `${story.title || ''} ${story.description || ''} ${epic.name || ''}`;
        if (Array.isArray(story.tasks)) {
          story.tasks.forEach((t) => {
            const taskTitle = typeof t === 'object' ? t.title : String(t);
            const taskDesc = typeof t === 'object' ? t.description : '';
            combinedText += ` ${taskTitle} ${taskDesc}`;
          });
        }

        const taskDomainScores = this.analyzeTaskContext(combinedText);

        // Tìm thành viên phù hợp nhất cho Story này
        let bestMember = members[0];
        let highestFinalScore = -Infinity;
        let matchReason = '';

        members.forEach((member) => {
          const memberScores = member.strengthScores || {};
          let skillMatchScore = 0;

          // So khớp điểm thế mạnh giữa Story và hồ sơ thành viên
          for (const [catKey, domainVal] of Object.entries(taskDomainScores)) {
            if (domainVal > 0) {
              const memberProficiency = memberScores[catKey] || 0;
              skillMatchScore += domainVal * (1.5 + memberProficiency * 0.4);
            }
          }

          // Phạt tải: Giảm điểm nếu thành viên này đã nhận nhiều task trong phiên này
          const currentLoad = workloadTracker[member.accountId] || 0;
          const penalty = currentLoad * 2.5;

          const finalScore = skillMatchScore - penalty;

          if (finalScore > highestFinalScore) {
            highestFinalScore = finalScore;
            bestMember = member;

            // Xây dựng lý do phân công
            const dominantStrength = member.primaryStrength || 'Fullstack';
            matchReason = `Gán cho ${member.displayName} theo thế mạnh ${dominantStrength} (kinh nghiệm từ các task trước) & gom nhóm cùng Story để chống xung đột code khi merge.`;
          }
        });

        // ── 1. Gán Story cho Lead Developer ───────────────────────────────
        story.assigneeId = bestMember.accountId;
        story.assigneeName = bestMember.displayName;
        story.assigneeAvatar = bestMember.avatarUrl || '';
        story.assigneeRole = bestMember.primaryStrength;
        story.assignmentReason = matchReason;
        totalAssignedStories++;

        // ── 2. Chống xung đột merge code: Gán toàn bộ Subtask con cho cùng 1 Dev ─
        if (Array.isArray(story.tasks)) {
          story.tasks = story.tasks.map((task, taskIdx) => {
            const taskObj = typeof task === 'object' ? { ...task } : { id: `task-${epicIdx}-${storyIdx}-${taskIdx}`, title: String(task), description: '' };

            taskObj.assigneeId = bestMember.accountId;
            taskObj.assigneeName = bestMember.displayName;
            taskObj.assigneeAvatar = bestMember.avatarUrl || '';
            taskObj.assigneeRole = bestMember.primaryStrength;
            taskObj.assignmentReason = `Được gom cùng Story "${story.title}" để ${bestMember.displayName} tự hoàn thiện, tránh xung đột code khi merge.`;

            // Tăng số lượng task cho member
            workloadTracker[bestMember.accountId] = (workloadTracker[bestMember.accountId] || 0) + 1;
            totalAssignedTasks++;

            return taskObj;
          });
        }
      });
    });

    const stats = {};
    members.forEach((m) => {
      stats[m.displayName] = workloadTracker[m.accountId] || 0;
    });

    const rationaleSummary = `✓ Đã tự động phân công thành công ${totalAssignedStories} Story và ${totalAssignedTasks} Sub-task cho ${members.length} thành viên dựa trên thế mạnh đã học từ lịch sử và gom cụm tính năng để hạn chế tối đa xung đột khi merge code!`;

    return {
      epics: assignedEpics,
      stats,
      rationaleSummary,
    };
  }
}

module.exports = SmartAssignService;
