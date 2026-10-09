const axios = require('axios');
const ConfigModel = require('../models/config.model');
const JiraIssueModel = require('../models/jiraIssue.model');
const ProjectModel = require('../models/project.model');
const CryptoService = require('./crypto.service');
const NotificationService = require('./notification.service');

const N8N_JIRA_WEBHOOK_URL =
  process.env.N8N_JIRA_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/push-to-jira';

async function postToN8n(url, payload, options = {}) {
  try {
    return await axios.post(url, payload, options);
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (url.includes('/webhook-test/')) {
        fallbackUrl = url.replace('/webhook-test/', '/webhook/');
      } else if (url.includes('/webhook/')) {
        fallbackUrl = url.replace('/webhook/', '/webhook-test/');
      }
      if (fallbackUrl) {
        console.log(`[JiraService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, options);
      }
    }
    throw err;
  }
}

class JiraService {
  /**
   * Đẩy dữ liệu cấu trúc Epic -> Story -> Task lên Jira thông qua n8n automation engine
   * @param {Object} params
   * @param {string} params.userId - UUID của người dùng hiện tại
   * @param {string} params.projectKey - Jira Project Key (vd: KAN, PROJ)
   * @param {Array} params.epics - Danh sách Epic -> Story -> Task cần tạo
   */
  static async pushToJira({ userId, projectKey, epics }) {
    if (!projectKey || typeof projectKey !== 'string' || !projectKey.trim()) {
      const err = new Error('Vui lòng cung cấp Jira Project Key (ví dụ: KAN, PROJ).');
      err.statusCode = 400;
      throw err;
    }

    if (!Array.isArray(epics) || epics.length === 0) {
      const err = new Error('Danh sách Epic không được rỗng.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Lấy thông tin cấu hình tích hợp Jira của user từ PostgreSQL
    const config = await ConfigModel.findByUserId(userId);
    if (
      !config ||
      !config.jira_domain ||
      !config.jira_email ||
      !config.jira_api_token_encrypted
    ) {
      const err = new Error(
        'Bạn chưa cấu hình thông tin Jira (Domain, Email hoặc API Token). Vui lòng vào mục Cài đặt (Settings) để cấu hình trước khi đẩy dữ liệu.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Giải mã bí mật Jira API Token bằng AES-256
    let jiraApiToken;
    try {
      jiraApiToken = CryptoService.decrypt(config.jira_api_token_encrypted);
    } catch (e) {
      const err = new Error('Không thể giải mã Jira API Token trong cơ sở dữ liệu.');
      err.statusCode = 500;
      throw err;
    }

    // 3. Chuẩn bị payload gửi sang n8n Webhook
    const cleanDomain = config.jira_domain.trim().split('?')[0].replace(/\/+$/, '');
    const authHeader =
      'Basic ' +
      Buffer.from(`${config.jira_email.trim()}:${jiraApiToken}`).toString('base64');

    const payload = {
      jiraDomain: cleanDomain,
      jiraEmail: config.jira_email.trim(),
      jiraApiToken,
      projectKey: projectKey.trim().toUpperCase(),
      epics,
    };

    // 4. Express gọi sang cỗ máy n8n
    try {
      let resultData = null;
      try {
        console.log(`[JiraService] Gọi sang n8n webhook: ${N8N_JIRA_WEBHOOK_URL}`);
        const response = await postToN8n(N8N_JIRA_WEBHOOK_URL, payload, {
          timeout: 180000, // Timeout 3 phút cho các dự án nhiều task
          headers: {
            'Content-Type': 'application/json',
          },
        });

        resultData = response.data;
      } catch (n8nErr) {
        console.warn(
          `[JiraService] n8n webhook không phản hồi hoặc gặp lỗi (${n8nErr.message}). Chuyển sang tạo trực tiếp qua Jira REST API...`
        );
      }

      // Nếu n8n không tạo được issues, tự động tạo trực tiếp qua Jira REST API
      if (
        !resultData ||
        !Array.isArray(resultData.createdIssues) ||
        resultData.createdIssues.length === 0
      ) {
        console.log('[JiraService] Đang tạo toàn bộ issues trực tiếp lên Jira Cloud...');
        resultData = await JiraService.createIssuesDirectlyOnJira({
          cleanDomain,
          authHeader,
          projectKey: projectKey.trim().toUpperCase(),
          epics,
        });
      }

    // Tìm project liên kết với projectKey và user nếu có
    let linkedProjectId = null;
    try {
      const foundProject = await ProjectModel.findByProjectKeyAndUserId(projectKey, userId);
      if (foundProject) linkedProjectId = foundProject.id;
    } catch (pErr) {
      // Non-blocking
    }

      // Lưu lại các issue vừa tạo vào cơ sở dữ liệu để theo dõi & đồng bộ ngược (Luồng 9)
      if (Array.isArray(resultData?.createdIssues)) {
        for (const iss of resultData.createdIssues) {
          try {
            await JiraIssueModel.upsert({
              issueKey: iss.key,
              issueId: iss.id,
              projectKey: projectKey.trim().toUpperCase(),
              summary: iss.title,
              issueType: iss.type,
              status: 'To Do',
              statusCategory: 'To Do',
              assignee: iss.assignee || null,
              jiraUrl: iss.url || null,
              userId,
              projectId: linkedProjectId,
              parentKey: iss.parent || null,
            });
          } catch (dbErr) {
            console.error('[JiraService] Lỗi lưu issue vào DB:', dbErr.message);
          }
        }

        // Luồng 11: Phát sự kiện thông báo tự động (Automated Notification) khi Epic được tạo thành công
        // Backend chỉ phát sự kiện sau khi Jira xác nhận tạo Epic thành công và đã lưu DB.
        // Thiết kế non-blocking: lỗi timeout/n8n không làm sai lệch kết quả trả về của Flow 7.
        const createdEpics = resultData.createdIssues.filter(
          (iss) => iss.type && iss.type.trim().toLowerCase() === 'epic'
        );

        if (createdEpics.length > 0) {
          console.log(`[JiraService] Phát hiện ${createdEpics.length} Epic được tạo thành công. Bắt đầu phát sự kiện Luồng 11...`);
          for (const epicIssue of createdEpics) {
            // Tìm thông tin mô tả bổ sung từ mảng epics đầu vào nếu có
            const matchingInputEpic = Array.isArray(epics)
              ? epics.find((e) => (e.name || e.summary) === epicIssue.title)
              : null;

            const enrichedEpic = {
              ...epicIssue,
              description: epicIssue.description || matchingInputEpic?.description || '',
            };

            // Gọi bất đồng bộ (non-blocking) tới NotificationService
            NotificationService.sendEpicCreatedNotification({
              userId,
              projectKey: projectKey.trim().toUpperCase(),
              epic: enrichedEpic,
              projectId: null,
            }).catch((err) => {
              console.error(
                `[JiraService] [Luồng 11] Lỗi thông báo cho Epic ${epicIssue.key}:`,
                err.message
              );
            });
          }
        }
      }

      return resultData;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        const err = new Error(
          `Không thể kết nối đến n8n tại ${N8N_JIRA_WEBHOOK_URL}. Hãy đảm bảo n8n đang chạy và workflow Push-to-Jira đã được kích hoạt!`
        );
        err.statusCode = 502;
        throw err;
      }

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Lỗi xảy ra trong quá trình n8n tạo issue trên Jira.';
      const err = new Error(message);
      err.statusCode = error.response?.status || 500;
      throw err;
    }
  }

  /**
   * Lấy danh sách thành viên/assignable users của dự án từ Jira Cloud REST API
   * @param {Object} params
   * @param {string} params.userId - UUID của người dùng hiện tại
   * @param {string} [params.projectKey] - Mã dự án Jira (ví dụ: KAN, PROJ)
   */
  static async getProjectMembers({ userId, projectKey }) {
    // 1. Lấy thông tin cấu hình Jira của user
    const config = await ConfigModel.findByUserId(userId);
    if (
      !config ||
      !config.jira_domain ||
      !config.jira_email ||
      !config.jira_api_token_encrypted
    ) {
      const err = new Error(
        'Bạn chưa cấu hình thông tin Jira (Domain, Email hoặc API Token). Vui lòng vào mục Cài đặt (Settings) để cấu hình trước.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Giải mã API token
    let jiraApiToken;
    try {
      jiraApiToken = CryptoService.decrypt(config.jira_api_token_encrypted);
    } catch (e) {
      const err = new Error('Không thể giải mã Jira API Token trong cơ sở dữ liệu.');
      err.statusCode = 500;
      throw err;
    }

    const cleanDomain = config.jira_domain.trim().split('?')[0].replace(/\/+$/, '');
    const authHeader =
      'Basic ' +
      Buffer.from(`${config.jira_email.trim()}:${jiraApiToken}`).toString('base64');

    // 3. Gọi Jira API lấy danh sách assignable users
    const queryParams = new URLSearchParams();
    if (projectKey && projectKey.trim()) {
      queryParams.append('project', projectKey.trim().toUpperCase());
    }
    queryParams.append('maxResults', '50');

    const jiraUrl = `${cleanDomain}/rest/api/2/user/assignable/search?${queryParams.toString()}`;

    try {
      console.log(`[JiraService] Gọi Jira API lấy danh sách thành viên: ${jiraUrl}`);
      const response = await axios.get(jiraUrl, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        timeout: 15000,
      });

      const users = Array.isArray(response.data) ? response.data : [];

      const members = users
        .filter((u) => u.active !== false && (u.accountType === 'atlassian' || !u.accountType))
        .map((u) => ({
          accountId: u.accountId,
          displayName: u.displayName || u.name || 'Thành viên',
          emailAddress: u.emailAddress || '',
          avatarUrl:
            u.avatarUrls?.['48x48'] ||
            u.avatarUrls?.['32x32'] ||
            u.avatarUrls?.['24x24'] ||
            '',
          accountType: u.accountType || 'atlassian',
          active: u.active,
        }));

      return members;
    } catch (error) {
      const message =
        error.response?.data?.errorMessages?.join(', ') ||
        error.response?.data?.message ||
        error.message ||
        'Không thể lấy danh sách thành viên từ Jira.';
      const err = new Error(`Lỗi Jira API (${error.response?.status || 500}): ${message}`);
      err.statusCode = error.response?.status || 500;
      throw err;
    }
  }

  /**
   * Lấy danh sách các dự án thực tế trên Jira Cloud của người dùng
   * @param {string} userId
   */
  static async getJiraProjects(userId) {
    const config = await ConfigModel.findByUserId(userId);
    if (
      !config ||
      !config.jira_domain ||
      !config.jira_email ||
      !config.jira_api_token_encrypted
    ) {
      return [];
    }

    let jiraApiToken;
    try {
      jiraApiToken = CryptoService.decrypt(config.jira_api_token_encrypted);
    } catch (e) {
      return [];
    }

    const cleanDomain = config.jira_domain.trim().split('?')[0].replace(/\/+$/, '');
    const authHeader =
      'Basic ' +
      Buffer.from(`${config.jira_email.trim()}:${jiraApiToken}`).toString('base64');

    try {
      const res = await axios.get(`${cleanDomain}/rest/api/2/project`, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      return (Array.isArray(res.data) ? res.data : []).map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        avatarUrl: p.avatarUrls?.['32x32'] || p.avatarUrls?.['48x48'] || '',
      }));
    } catch (err) {
      console.warn('[JiraService] Lỗi khi lấy danh sách dự án Jira:', err.message);
      return [];
    }
  }

  /**
   * Tạo toàn bộ issues trực tiếp lên Jira REST API
   */
  static async createIssuesDirectlyOnJira({ cleanDomain, authHeader, projectKey, epics }) {
    let storyTypeName = 'Story';
    let subtaskTypeName = 'Subtask';
    try {
      const metaRes = await axios.get(
        `${cleanDomain}/rest/api/2/issue/createmeta?projectKeys=${projectKey}`,
        {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          timeout: 10000,
        }
      );
      const types = metaRes.data?.projects?.[0]?.issuetypes || [];
      const hasStory = types.some((t) => t.name.toLowerCase() === 'story');
      if (!hasStory) {
        storyTypeName = 'Task';
      }
      const hasSubtask = types.some((t) => t.name.toLowerCase() === 'subtask');
      const hasSub_task = types.some((t) => t.name.toLowerCase() === 'sub-task');
      if (hasSub_task) subtaskTypeName = 'Sub-task';
      else if (hasSubtask) subtaskTypeName = 'Subtask';
    } catch (e) {
      // Dùng cấu hình mặc định
    }

    const createdIssues = [];
    let epicsCount = 0;
    let storiesCount = 0;
    let tasksCount = 0;

    for (const epic of epics) {
      const epicTitle = epic.title || 'Untitled Epic';
      const epicDesc = epic.description || epicTitle;

      const epicRes = await axios.post(
        `${cleanDomain}/rest/api/2/issue`,
        {
          fields: {
            project: { key: projectKey },
            summary: epicTitle,
            description: epicDesc,
            issuetype: { name: 'Epic' },
          },
        },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 20000,
        }
      );

      const epicKey = epicRes.data.key;
      epicsCount++;
      createdIssues.push({
        type: 'Epic',
        key: epicKey,
        id: epicRes.data.id,
        title: epicTitle,
        parent: null,
        assignee: null,
        url: `${cleanDomain}/browse/${epicKey}`,
      });

      const stories = epic.stories || epic.user_stories || [];
      for (const story of stories) {
        const storyTitle = story.title || 'Untitled Story';
        const storyDesc = story.description || storyTitle;

        const storyFields = {
          project: { key: projectKey },
          summary: storyTitle,
          description: storyDesc,
          issuetype: { name: storyTypeName },
          parent: { key: epicKey },
        };
        if (story.assigneeId) {
          storyFields.assignee = { accountId: story.assigneeId };
        }

        const storyRes = await axios.post(
          `${cleanDomain}/rest/api/2/issue`,
          { fields: storyFields },
          {
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 20000,
          }
        );

        const storyKey = storyRes.data.key;
        storiesCount++;
        createdIssues.push({
          type: storyTypeName,
          key: storyKey,
          id: storyRes.data.id,
          title: storyTitle,
          parent: epicKey,
          assignee: story.assigneeName || null,
          url: `${cleanDomain}/browse/${storyKey}`,
        });

        const tasks = story.tasks || story.subtasks || [];
        for (const task of tasks) {
          const taskTitle =
            typeof task === 'string' ? task : task.title || 'Untitled Subtask';
          const taskDesc =
            typeof task === 'object' ? task.description || taskTitle : taskTitle;
          const assigneeId = typeof task === 'object' ? task.assigneeId : null;
          const assigneeName = typeof task === 'object' ? task.assigneeName : null;

          const taskFields = {
            project: { key: projectKey },
            summary: taskTitle,
            description: taskDesc,
            issuetype: { name: subtaskTypeName },
            parent: { key: storyKey },
          };
          if (assigneeId) {
            taskFields.assignee = { accountId: assigneeId };
          }

          let taskRes;
          try {
            taskRes = await axios.post(
              `${cleanDomain}/rest/api/2/issue`,
              { fields: taskFields },
              {
                headers: {
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                timeout: 20000,
              }
            );
          } catch (taskErr) {
            // Thử đổi giữa Subtask và Sub-task nếu Jira dùng tên còn lại
            const altTypeName =
              subtaskTypeName === 'Subtask' ? 'Sub-task' : 'Subtask';
            taskFields.issuetype = { name: altTypeName };
            taskRes = await axios.post(
              `${cleanDomain}/rest/api/2/issue`,
              { fields: taskFields },
              {
                headers: {
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                timeout: 20000,
              }
            );
          }

          const taskKey = taskRes.data.key;
          tasksCount++;
          createdIssues.push({
            type: subtaskTypeName,
            key: taskKey,
            id: taskRes.data.id,
            title: taskTitle,
            parent: storyKey,
            assignee: assigneeName || null,
            url: `${cleanDomain}/browse/${taskKey}`,
          });
        }
      }
    }

    return {
      success: true,
      message: `Đã tạo thành công ${epicsCount} Epic, ${storiesCount} Story, ${tasksCount} Sub-task trên Jira!`,
      summary: {
        epicsCount,
        storiesCount,
        tasksCount,
        totalIssues: epicsCount + storiesCount + tasksCount,
      },
      projectKey,
      jiraDomain: cleanDomain,
      createdIssues,
    };
  }

  /**
   * Xử lý Webhook gửi từ Jira Cloud (Luồng 9: Đồng bộ trạng thái ngược)
   * @param {Object} payload - Payload gửi từ Jira Webhook
   */
  static async handleJiraWebhook(payload) {
    if (!payload || typeof payload !== 'object') {
      const err = new Error('Payload webhook không hợp lệ.');
      err.statusCode = 400;
      throw err;
    }

    const webhookEvent = payload.webhookEvent || 'jira:issue_updated';
    const issueObj = payload.issue || {};
    const issueKey = issueObj.key || payload.issueKey;

    if (!issueKey) {
      console.warn('[JiraService] Webhook không chứa issue key, bỏ qua.');
      return { action: 'ignored', message: 'Không tìm thấy issue key trong payload.' };
    }

    // Nếu là sự kiện xóa issue trên Jira
    if (webhookEvent === 'jira:issue_deleted') {
      await JiraIssueModel.deleteByKey(issueKey);
      return {
        action: 'deleted',
        issueKey,
        message: `Đã xóa issue ${issueKey} khỏi cơ sở dữ liệu website.`,
      };
    }

    // Trích xuất thông tin chi tiết từ Jira issue payload
    const fields = issueObj.fields || {};
    const statusObj = fields.status || {};
    const status = statusObj.name || payload.status || 'To Do';
    const statusCategory =
      statusObj.statusCategory?.name || payload.statusCategory || status;
    const summary = fields.summary || payload.summary || `Issue ${issueKey}`;
    const description =
      typeof fields.description === 'string'
        ? fields.description
        : payload.description || null;
    const issueType = fields.issuetype?.name || payload.issueType || 'Task';
    const projectKey =
      fields.project?.key || payload.projectKey || issueKey.split('-')[0];
    const assignee =
      fields.assignee?.displayName || payload.assignee || null;
    const parentKey =
      fields.parent?.key || payload.parentKey || payload.parent || null;

    // Tự sinh URL xem issue trên Jira nếu có domain
    let jiraUrl = payload.jiraUrl || null;
    if (!jiraUrl && issueObj.self) {
      jiraUrl = issueObj.self.replace(/\/rest\/api\/.*$/, `/browse/${issueKey}`);
    }

    console.log(
      `[JiraService] [Webhook Sync] Cập nhật issue ${issueKey} sang trạng thái: "${status}" (Assignee: ${assignee || 'Unassigned'})`
    );

    const updatedIssue = await JiraIssueModel.upsert({
      issueKey,
      issueId: issueObj.id || null,
      projectKey,
      summary,
      description,
      issueType,
      status,
      statusCategory,
      assignee,
      jiraUrl,
      parentKey,
    });

    return {
      action: 'synced',
      issueKey,
      status,
      issue: updatedIssue,
      message: `Đồng bộ thành công issue ${issueKey} -> Trạng thái: "${status}".`,
    };
  }

  /**
   * Lấy danh sách các issue Jira đã đồng bộ từ database
   * @param {string} [projectKey] - Mã dự án Jira
   */
  static async getSyncedIssues(projectKey) {
    if (projectKey && projectKey.trim()) {
      return await JiraIssueModel.findByProjectKey(projectKey.trim().toUpperCase());
    }
    return await JiraIssueModel.findAll();
  }

  /**
   * Giả lập (Simulate) Webhook từ Jira phục vụ kiểm thử và demo cho giảng viên
   * @param {Object} params
   */
  static async simulateWebhookSync({
    issueKey,
    status = 'Done',
    assignee,
    summary,
    issueType = 'Task',
    projectKey,
  }) {
    if (!issueKey || !issueKey.trim()) {
      const err = new Error('Vui lòng cung cấp mã issue (ví dụ: KAN-1).');
      err.statusCode = 400;
      throw err;
    }

    const cleanKey = issueKey.trim().toUpperCase();
    const cleanProjectKey = projectKey || cleanKey.split('-')[0];

    const payload = {
      webhookEvent: 'jira:issue_updated',
      issueKey: cleanKey,
      status,
      statusCategory: status,
      assignee: assignee || undefined,
      summary: summary || undefined,
      issueType,
      projectKey: cleanProjectKey,
      issue: {
        key: cleanKey,
        fields: {
          summary: summary || `Issue ${cleanKey}`,
          status: { name: status, statusCategory: { name: status } },
          issuetype: { name: issueType },
          project: { key: cleanProjectKey },
          assignee: assignee ? { displayName: assignee } : null,
        },
      },
    };

    return await this.handleJiraWebhook(payload);
  }
}

module.exports = JiraService;
