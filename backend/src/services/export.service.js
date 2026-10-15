const path = require('path');
const PDFDocument = require('pdfkit');
const JiraIssueModel = require('../models/jiraIssue.model');
const ProjectModel = require('../models/project.model');

// Đường dẫn font Unicode hỗ trợ đầy đủ tiếng Việt có dấu
const FONT_REGULAR = path.resolve(__dirname, '../assets/fonts/DejaVuSans.ttf');
const FONT_BOLD = path.resolve(__dirname, '../assets/fonts/DejaVuSans-Bold.ttf');

class ExportService {
  /**
   * Định dạng ngày giờ hiển thị theo chuẩn Việt Nam
   */
  static formatDateTime(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Tạo tên file an toàn theo format: AI-Jira-Agent-[PROJECT_KEY]-[YYYY-MM-DD].[ext]
   */
  static generateFileName(projectKey, format = 'pdf') {
    const cleanKey = (projectKey || 'PROJ').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'PROJ';
    const dateStr = new Date().toISOString().slice(0, 10);
    const ext = format.toLowerCase() === 'pdf' ? 'pdf' : 'md';
    return `AI-Jira-Agent-${cleanKey}-${dateStr}.${ext}`;
  }

  /**
   * Lấy và cấu trúc hóa cây phân cấp từ bảng jira_issues trong PostgreSQL (source = 'jira')
   */
  static async getHierarchyFromJira({ projectId, userId, project }) {
    const projectKey = project?.project_key || ProjectModel.generateDefaultKey(project?.name);
    const issues = await JiraIssueModel.findByProjectForExport({
      projectId,
      projectKey,
      userId,
    });

    // Phân loại issue theo loại
    const epicsMap = new Map();
    const storiesMap = new Map();
    const tasks = [];
    const orphanStories = [];

    // 1. Phân nhóm cấp 1: Epic
    issues.forEach((iss) => {
      const type = (iss.issue_type || '').trim().toLowerCase();
      if (type === 'epic') {
        epicsMap.set(iss.issue_key, {
          key: iss.issue_key,
          title: iss.summary,
          description: iss.description || '',
          status: iss.status || 'To Do',
          statusCategory: iss.status_category || '',
          assignee: iss.assignee || null,
          jiraUrl: iss.jira_url || null,
          createdAt: iss.created_at,
          stories: [],
        });
      }
    });

    // 2. Phân nhóm cấp 2: Story
    issues.forEach((iss) => {
      const type = (iss.issue_type || '').trim().toLowerCase();
      if (type === 'story') {
        const storyObj = {
          key: iss.issue_key,
          title: iss.summary,
          description: iss.description || '',
          status: iss.status || 'To Do',
          statusCategory: iss.status_category || '',
          assignee: iss.assignee || null,
          jiraUrl: iss.jira_url || null,
          parentKey: iss.parent_key || null,
          createdAt: iss.created_at,
          tasks: [],
        };
        storiesMap.set(iss.issue_key, storyObj);

        if (iss.parent_key && epicsMap.has(iss.parent_key)) {
          epicsMap.get(iss.parent_key).stories.push(storyObj);
        } else {
          orphanStories.push(storyObj);
        }
      }
    });

    // 3. Phân nhóm cấp 3: Task / Subtask
    issues.forEach((iss) => {
      const type = (iss.issue_type || '').trim().toLowerCase();
      if (type !== 'epic' && type !== 'story') {
        const taskObj = {
          key: iss.issue_key,
          title: iss.summary,
          description: iss.description || '',
          status: iss.status || 'To Do',
          statusCategory: iss.status_category || '',
          assignee: iss.assignee || null,
          jiraUrl: iss.jira_url || null,
          parentKey: iss.parent_key || null,
          type: iss.issue_type || 'Task',
          createdAt: iss.created_at,
        };
        tasks.push(taskObj);

        if (iss.parent_key && storiesMap.has(iss.parent_key)) {
          storiesMap.get(iss.parent_key).tasks.push(taskObj);
        }
      }
    });

    // 4. Xử lý các Story hoặc Task không có liên kết parent
    const epicsList = Array.from(epicsMap.values());

    if (orphanStories.length > 0) {
      if (epicsList.length === 0) {
        // Tạo một Epic nhóm chung nếu không có Epic nào
        epicsList.push({
          key: null,
          title: 'User Stories (Chưa gán Epic)',
          description: '',
          status: null,
          assignee: null,
          jiraUrl: null,
          stories: orphanStories,
        });
      } else {
        // Nếu có Epic, đưa Story không có parent vào Epic đầu tiên hoặc Epic chung
        const defaultEpic = epicsList[0];
        orphanStories.forEach((s) => defaultEpic.stories.push(s));
      }
    }

    // Các task không tìm thấy parent story
    const unattachedTasks = tasks.filter(
      (t) => !t.parentKey || !storiesMap.has(t.parentKey)
    );
    if (unattachedTasks.length > 0) {
      let targetStory = null;
      if (epicsList.length > 0 && epicsList[0].stories.length > 0) {
        targetStory = epicsList[0].stories[0];
      } else {
        targetStory = {
          key: null,
          title: 'General Tasks (Chưa gán Story)',
          description: '',
          status: null,
          assignee: null,
          jiraUrl: null,
          tasks: [],
        };
        if (epicsList.length === 0) {
          epicsList.push({
            key: null,
            title: 'General Requirements',
            description: '',
            status: null,
            assignee: null,
            jiraUrl: null,
            stories: [targetStory],
          });
        } else {
          epicsList[0].stories.push(targetStory);
        }
      }
      unattachedTasks.forEach((t) => targetStory.tasks.push(t));
    }

    // Tính toán số lượng thống kê
    let storiesCount = 0;
    let tasksCount = 0;
    epicsList.forEach((e) => {
      storiesCount += e.stories.length;
      e.stories.forEach((s) => {
        tasksCount += s.tasks.length;
      });
    });

    const epicsCount = epicsMap.size > 0 ? epicsMap.size : (epicsList.length > 0 && epicsList[0].key ? epicsList.length : 0);

    return {
      projectName: project?.name || 'AI Jira Project',
      projectKey,
      projectDescription: project?.description || '',
      exportedAt: this.formatDateTime(),
      source: 'jira',
      sourceLabel: 'Jira Cloud (Đã đồng bộ vào cơ sở dữ liệu)',
      stats: {
        epicsCount,
        storiesCount,
        tasksCount,
        totalIssues: issues.length,
      },
      epics: epicsList,
    };
  }

  /**
   * Chuẩn hóa dữ liệu bản nháp AI (source = 'draft')
   */
  static normalizeHierarchyFromDraft({ draftData, project }) {
    const projectKey = project?.project_key || ProjectModel.generateDefaultKey(project?.name);
    let rawEpics = [];

    if (Array.isArray(draftData)) {
      rawEpics = draftData;
    } else if (draftData && Array.isArray(draftData.epics)) {
      rawEpics = draftData.epics;
    } else if (draftData && draftData.data && Array.isArray(draftData.data.epics)) {
      rawEpics = draftData.data.epics;
    } else if (draftData && draftData.result && Array.isArray(draftData.result.epics)) {
      rawEpics = draftData.result.epics;
    }

    let storiesCount = 0;
    let tasksCount = 0;

    const epics = rawEpics.map((epic, ei) => {
      const rawStories = epic.stories || epic.user_stories || epic.userStories || [];
      const stories = rawStories.map((story, si) => {
        storiesCount++;
        const rawTasks = story.tasks || story.subtasks || [];
        const tasks = rawTasks.map((task, ti) => {
          tasksCount++;
          const isStr = typeof task === 'string';
          return {
            key: isStr ? null : task.key || null,
            title: isStr ? task : task.title || task.name || task.summary || `Task #${ti + 1}`,
            description: isStr ? '' : task.description || task.desc || '',
            status: isStr ? 'Bản nháp' : task.status || 'Bản nháp',
            assignee: isStr ? null : task.assigneeName || task.assignee || null,
            jiraUrl: null,
            type: 'Task',
          };
        });

        return {
          key: story.key || null,
          title: story.title || story.name || story.user_story || story.summary || `User Story #${si + 1}`,
          description: story.description || story.desc || '',
          status: story.status || 'Bản nháp',
          assignee: story.assigneeName || story.assignee || null,
          jiraUrl: null,
          tasks,
        };
      });

      return {
        key: epic.key || null,
        title: epic.title || epic.name || epic.epic_name || epic.summary || `Epic #${ei + 1}`,
        description: epic.description || epic.details || epic.desc || '',
        status: epic.status || 'Bản nháp',
        assignee: epic.assigneeName || epic.assignee || null,
        jiraUrl: null,
        stories,
      };
    });

    const epicsCount = epics.length;

    return {
      projectName: project?.name || 'AI Jira Project',
      projectKey,
      projectDescription: project?.description || '',
      exportedAt: this.formatDateTime(),
      source: 'draft',
      sourceLabel: 'Bản nháp AI (Chưa đẩy lên Jira)',
      stats: {
        epicsCount,
        storiesCount,
        tasksCount,
        totalIssues: epicsCount + storiesCount + tasksCount,
      },
      epics,
    };
  }

  /**
   * Tạo tài liệu định dạng Markdown (.md)
   */
  static generateMarkdown(model) {
    const {
      projectName,
      projectKey,
      projectDescription,
      exportedAt,
      sourceLabel,
      stats,
      epics,
    } = model;

    let md = '';

    // Tiêu đề & Metadata
    md += `# Dự án: ${projectName}\n\n`;
    md += `- **Mã dự án (Project Key):** \`${projectKey}\`\n`;
    md += `- **Thời gian xuất (Exported At):** ${exportedAt}\n`;
    md += `- **Nguồn dữ liệu (Data Source):** ${sourceLabel}\n`;
    md += `- **Tổng số yêu cầu:** ${stats.totalIssues} issue(s) (Epic: ${stats.epicsCount}, User Story: ${stats.storiesCount}, Task/Sub-task: ${stats.tasksCount})\n`;

    if (projectDescription) {
      md += `\n### Mô tả dự án\n${projectDescription}\n`;
    }

    md += `\n---\n\n`;

    if (!epics || epics.length === 0) {
      md += `*Hiện tại dự án chưa có Epic, Story hoặc Task nào được ghi nhận.*\n`;
      return md;
    }

    // Danh sách phân cấp
    epics.forEach((epic, eIdx) => {
      const epicKeyPrefix = epic.key ? `[${epic.key}] ` : '';
      md += `## Epic ${eIdx + 1}: ${epicKeyPrefix}${epic.title}\n\n`;

      if (epic.status) md += `- **Trạng thái:** \`${epic.status}\`\n`;
      if (epic.assignee) md += `- **Người phụ trách:** ${epic.assignee}\n`;
      if (epic.jiraUrl) md += `- **Liên kết Jira:** [${epic.key || 'Xem trên Jira'}](${epic.jiraUrl})\n`;
      if (epic.description) {
        md += `- **Mô tả:** ${epic.description.replace(/\n+/g, ' ')}\n`;
      }
      md += `\n`;

      if (!epic.stories || epic.stories.length === 0) {
        md += `  *(Chưa có User Story nào thuộc Epic này)*\n\n`;
        return;
      }

      epic.stories.forEach((story, sIdx) => {
        const storyKeyPrefix = story.key ? `[${story.key}] ` : '';
        md += `### Story ${eIdx + 1}.${sIdx + 1}: ${storyKeyPrefix}${story.title}\n\n`;

        if (story.status) md += `  - **Trạng thái:** \`${story.status}\`\n`;
        if (story.assignee) md += `  - **Người phụ trách:** ${story.assignee}\n`;
        if (story.jiraUrl) md += `  - **Liên kết Jira:** [${story.key || 'Xem trên Jira'}](${story.jiraUrl})\n`;
        if (story.description) {
          md += `  - **Mô tả:** ${story.description.replace(/\n+/g, ' ')}\n`;
        }
        md += `\n`;

        if (!story.tasks || story.tasks.length === 0) {
          md += `    *(Chưa có Task/Sub-task nào)*\n\n`;
          return;
        }

        story.tasks.forEach((task, tIdx) => {
          const taskKeyPrefix = task.key ? `\`${task.key}\` ` : '';
          const statusText = task.status ? ` [${task.status}]` : '';
          const assigneeText = task.assignee ? ` — *${task.assignee}*` : '';
          const linkText = task.jiraUrl ? ` — [Jira](${task.jiraUrl})` : '';

          md += `- **Task ${eIdx + 1}.${sIdx + 1}.${tIdx + 1}:** ${taskKeyPrefix}${task.title}${statusText}${assigneeText}${linkText}\n`;
          if (task.description) {
            md += `  > ${task.description.replace(/\n+/g, ' ')}\n`;
          }
        });
        md += `\n`;
      });
    });

    md += `---\n*Tài liệu được xuất tự động bởi hệ thống AI Jira Agent.*\n`;
    return md;
  }

  /**
   * Tạo tài liệu định dạng PDF (.pdf) hỗ trợ Unicode tiếng Việt
   */
  static async generatePdf(model) {
    return new Promise((resolve, reject) => {
      try {
        const {
          projectName,
          projectKey,
          projectDescription,
          exportedAt,
          sourceLabel,
          stats,
          epics,
        } = model;

        const doc = new PDFDocument({
          margin: 45,
          size: 'A4',
          bufferPages: true,
          info: {
            Title: `Tài liệu yêu cầu phần mềm - ${projectName}`,
            Author: 'AI Jira Agent',
            Subject: `Requirement Export for ${projectKey}`,
            CreationDate: new Date(),
          },
        });

        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });
        doc.on('error', (err) => reject(err));

        // Đăng ký font Unicode
        doc.registerFont('DejaVuSans', FONT_REGULAR);
        doc.registerFont('DejaVuSans-Bold', FONT_BOLD);

        // ── 1. HEADER BANNER ──────────────────────────────────────────
        doc.rect(45, 45, 505, 75).fill('#0f172a'); // Slate 900 background

        doc.fillColor('#38bdf8').font('DejaVuSans-Bold').fontSize(18)
          .text('AI JIRA AGENT', 60, 58);

        doc.fillColor('#ffffff').font('DejaVuSans-Bold').fontSize(14)
          .text(`TÀI LIỆU YÊU CẦU PHẦN MỀM: ${projectName.toUpperCase()}`, 60, 80, { width: 475, ellipsis: true });

        doc.fillColor('#94a3b8').font('DejaVuSans').fontSize(9)
          .text(`Mã dự án: ${projectKey}  |  Ngày xuất: ${exportedAt}`, 60, 102);

        doc.y = 135;

        // ── 2. METADATA & SUMMARY BOX ─────────────────────────────────
        doc.roundedRect(45, doc.y, 505, 65, 4).fillAndStroke('#f8fafc', '#e2e8f0');

        const boxY = doc.y;
        doc.fillColor('#475569').font('DejaVuSans-Bold').fontSize(9)
          .text('NGUỒN DỮ LIỆU:', 60, boxY + 12);
        doc.fillColor('#0284c7').font('DejaVuSans').fontSize(9)
          .text(sourceLabel, 155, boxY + 12);

        if (projectDescription) {
          doc.fillColor('#475569').font('DejaVuSans-Bold').fontSize(9)
            .text('MÔ TẢ DỰ ÁN:', 60, boxY + 28);
          doc.fillColor('#334155').font('DejaVuSans').fontSize(8.5)
            .text(projectDescription, 155, boxY + 28, { width: 380, height: 16, ellipsis: true });
        }

        // Stats line
        doc.fillColor('#475569').font('DejaVuSans-Bold').fontSize(9)
          .text('TỔNG SỐ LƯỢNG:', 60, boxY + 44);
        doc.fillColor('#0f172a').font('DejaVuSans-Bold').fontSize(9)
          .text(`${stats.epicsCount} Epic   •   ${stats.storiesCount} User Story   •   ${stats.tasksCount} Task / Sub-task   (Tổng: ${stats.totalIssues} issue)`, 155, boxY + 44);

        doc.y = boxY + 80;

        // ── 3. HIERARCHY CONTENT ──────────────────────────────────────
        if (!epics || epics.length === 0) {
          doc.moveDown(1.5);
          doc.fillColor('#64748b').font('DejaVuSans').fontSize(11)
            .text('Hiện tại dự án chưa có issue hoặc bản nháp nào được ghi nhận.', { align: 'center' });
        } else {
          epics.forEach((epic, eIdx) => {
            // Kiểm tra phân trang nếu gần đáy trang
            if (doc.y > 680) {
              doc.addPage();
            }

            doc.moveDown(0.8);
            const epicY = doc.y;

            // Epic Accent line & Header Box
            doc.rect(45, epicY, 4, 22).fill('#2563eb'); // Blue bar
            doc.rect(49, epicY, 501, 22).fill('#eff6ff');

            const epicTitleText = `${eIdx + 1}. Epic: ${epic.key ? `[${epic.key}] ` : ''}${epic.title}`;
            doc.fillColor('#1e40af').font('DejaVuSans-Bold').fontSize(11)
              .text(epicTitleText, 58, epicY + 5, { width: 480, ellipsis: true });

            doc.y = epicY + 28;

            // Epic metadata
            if (epic.status || epic.assignee || epic.jiraUrl) {
              let metaStr = '';
              if (epic.status) metaStr += `Trạng thái: ${epic.status}  `;
              if (epic.assignee) metaStr += `|  Người phụ trách: ${epic.assignee}  `;
              doc.fillColor('#64748b').font('DejaVuSans').fontSize(8.5).text(metaStr, 58, doc.y);

              if (epic.jiraUrl) {
                doc.fillColor('#2563eb').text(`[Xem trên Jira: ${epic.key}]`, 58, doc.y, {
                  link: epic.jiraUrl,
                  underline: true,
                });
              }
              doc.moveDown(0.3);
            }

            if (epic.description) {
              doc.fillColor('#475569').font('DejaVuSans').fontSize(8.5)
                .text(`Mô tả: ${epic.description}`, 58, doc.y, { width: 485 });
              doc.moveDown(0.4);
            }

            // Stories
            if (!epic.stories || epic.stories.length === 0) {
              doc.fillColor('#94a3b8').font('DejaVuSans').fontSize(8.5)
                .text('  (Chưa có User Story nào)', 68, doc.y);
              doc.moveDown(0.4);
            } else {
              epic.stories.forEach((story, sIdx) => {
                if (doc.y > 700) {
                  doc.addPage();
                }

                doc.moveDown(0.5);
                const storyY = doc.y;

                // Story bullet / badge
                doc.rect(65, storyY, 485, 18).fill('#f1f5f9');
                const storyTitleText = `${eIdx + 1}.${sIdx + 1} Story: ${story.key ? `[${story.key}] ` : ''}${story.title}`;
                doc.fillColor('#0f172a').font('DejaVuSans-Bold').fontSize(9.5)
                  .text(storyTitleText, 72, storyY + 4, { width: 470, ellipsis: true });

                doc.y = storyY + 22;

                // Story metadata
                if (story.status || story.assignee || story.jiraUrl) {
                  let sMeta = '';
                  if (story.status) sMeta += `Trạng thái: ${story.status}  `;
                  if (story.assignee) sMeta += `|  Phụ trách: ${story.assignee}  `;
                  doc.fillColor('#64748b').font('DejaVuSans').fontSize(8).text(sMeta, 75, doc.y);

                  if (story.jiraUrl) {
                    doc.fillColor('#2563eb').text(`[Mở Jira: ${story.key}]`, 75, doc.y, {
                      link: story.jiraUrl,
                      underline: true,
                    });
                  }
                  doc.moveDown(0.2);
                }

                if (story.description) {
                  doc.fillColor('#475569').font('DejaVuSans').fontSize(8)
                    .text(`Mô tả: ${story.description}`, 75, doc.y, { width: 470 });
                  doc.moveDown(0.3);
                }

                // Tasks
                if (story.tasks && story.tasks.length > 0) {
                  story.tasks.forEach((task, tIdx) => {
                    if (doc.y > 720) {
                      doc.addPage();
                    }

                    const taskKeyStr = task.key ? `[${task.key}] ` : '';
                    const taskStatusStr = task.status ? ` (${task.status})` : '';
                    const taskAssigneeStr = task.assignee ? ` — ${task.assignee}` : '';
                    const taskLine = `• Task ${eIdx + 1}.${sIdx + 1}.${tIdx + 1}: ${taskKeyStr}${task.title}${taskStatusStr}${taskAssigneeStr}`;

                    doc.fillColor('#1e293b').font('DejaVuSans').fontSize(8)
                      .text(taskLine, 88, doc.y, { width: 460 });

                    if (task.jiraUrl) {
                      doc.fillColor('#2563eb').fontSize(7.5)
                        .text(`[Link Jira: ${task.key}]`, 100, doc.y, { link: task.jiraUrl, underline: true });
                    }

                    if (task.description) {
                      doc.fillColor('#64748b').font('DejaVuSans').fontSize(7.5)
                        .text(`- ${task.description}`, 100, doc.y, { width: 445 });
                    }
                    doc.moveDown(0.2);
                  });
                }
              });
            }
          });
        }

        // ── 4. FOOTER VỚI SỐ TRANG TỰ ĐỘNG ────────────────────────────
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.rect(45, 785, 505, 0.5).fill('#cbd5e1'); // Line separator

          doc.fillColor('#94a3b8').font('DejaVuSans').fontSize(7.5)
            .text('Hệ thống AI Jira Agent — Tài liệu quản lý yêu cầu phần mềm', 45, 792, {
              align: 'left',
              width: 350,
            });

          doc.fillColor('#94a3b8').font('DejaVuSans').fontSize(7.5)
            .text(`Trang ${i + 1} / ${range.count}`, 400, 792, {
              align: 'right',
              width: 150,
            });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = ExportService;
