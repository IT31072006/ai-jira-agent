const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');
const ConfigModel = require('../models/config.model');
const ProjectModel = require('../models/project.model');
const UserModel = require('../models/user.model');

const N8N_NOTIFICATION_WEBHOOK_URL =
  process.env.N8N_NOTIFICATION_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/epic-created-notification';

const NOTIFICATION_WEBHOOK_SECRET =
  process.env.NOTIFICATION_WEBHOOK_SECRET ||
  'ai_jira_agent_notification_secret_key_2026';

/**
 * Gửi HTTP POST sang n8n webhook với cơ chế tự động fallback giữa /webhook/ và /webhook-test/
 */
async function postToN8n(primaryUrl, payload, headers, timeout = 15000) {
  try {
    return await axios.post(primaryUrl, payload, { headers, timeout });
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (primaryUrl.includes('/webhook-test/')) {
        fallbackUrl = primaryUrl.replace('/webhook-test/', '/webhook/');
      } else if (primaryUrl.includes('/webhook/')) {
        fallbackUrl = primaryUrl.replace('/webhook/', '/webhook-test/');
      }
      if (fallbackUrl) {
        console.log(`[NotificationService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, { headers, timeout });
      }
    }
    throw err;
  }
}

class NotificationService {
  /**
   * Lưu sự kiện thông báo vào bảng notification_events để đảm bảo tính Idempotency và Audit log
   */
  static async recordEvent({
    eventId,
    eventType = 'jira.epic.created',
    userId,
    projectId,
    projectKey,
    epicKey,
    epicSummary,
    channel,
    payload,
  }) {
    const query = `
      INSERT INTO notification_events (
        event_id, event_type, user_id, project_id, project_key,
        epic_key, epic_summary, channel, status, payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING *;
    `;
    const values = [
      eventId,
      eventType,
      userId || null,
      projectId || null,
      projectKey.trim().toUpperCase(),
      epicKey.trim().toUpperCase(),
      epicSummary ? epicSummary.slice(0, 500) : '',
      channel || 'discord',
      JSON.stringify(payload),
    ];
    const { rows } = await db.query(query, values);
    return rows[0] || null;
  }

  /**
   * Cập nhật trạng thái sự kiện khi đã gửi thành công
   */
  static async markEventSent(eventId, responseData = {}) {
    const query = `
      UPDATE notification_events
      SET
        status = 'sent',
        response_data = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [JSON.stringify(responseData), eventId]);
    return rows[0] || null;
  }

  /**
   * Cập nhật trạng thái sự kiện khi gửi thất bại
   */
  static async markEventFailed(eventId, errorMessage) {
    const query = `
      UPDATE notification_events
      SET
        status = 'failed',
        error_message = $1,
        retry_count = retry_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [String(errorMessage || 'Unknown error'), eventId]);
    return rows[0] || null;
  }

  /**
   * Kiểm tra sự kiện đã tồn tại chưa (Idempotency check)
   */
  static async findByEventId(eventId) {
    const query = `
      SELECT * FROM notification_events
      WHERE event_id = $1
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [eventId]);
    return rows[0] || null;
  }

  /**
   * Lấy lịch sử các thông báo của người dùng
   */
  static async getHistory(userId, limit = 20) {
    const query = `
      SELECT id, event_id, event_type, project_key, epic_key, epic_summary,
             channel, status, retry_count, error_message, created_at, updated_at
      FROM notification_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const { rows } = await db.query(query, [userId, limit]);
    return rows;
  }

  /**
   * Phát sự kiện thông báo khi tạo Epic thành công trên Jira (Luồng 11)
   * Hàm này được thiết kế NON-BLOCKING đối với Flow 7 (lỗi gửi thông báo không làm hỏng kết quả tạo issue).
   */
  static async sendEpicCreatedNotification({
    userId,
    projectKey,
    epic,
    projectId = null,
  }) {
    if (!epic || !epic.key) {
      console.warn('[NotificationService] Bỏ qua: Thông tin epic không hợp lệ.');
      return null;
    }

    let eventId = null;
    try {
      // 1. Lấy thông tin cấu hình thông báo của user
      const config = await ConfigModel.findByUserId(userId);
      if (!config) {
        console.log('[NotificationService] Bỏ qua: User chưa thiết lập cấu hình.');
        return null;
      }

      if (config.notification_enabled === false) {
        console.log('[NotificationService] Bỏ qua: Tính năng thông báo đang tắt.');
        return null;
      }

      // Xác định kênh thông báo và đích gửi
      const channel = config.notification_channel || 'discord';
      let targetUrl = null;
      let targetEmail = null;

      if (channel === 'discord') {
        targetUrl = config.discord_webhook_url;
      } else if (channel === 'slack') {
        targetUrl = config.slack_webhook_url;
      } else if (channel === 'email') {
        targetEmail = config.notification_email || config.jira_email;
      }

      // 2. Lấy thông tin user (actor) và project
      const [actor, project] = await Promise.all([
        UserModel.findById(userId),
        projectId
          ? ProjectModel.findByIdAndUserId(projectId, userId)
          : ProjectModel.findByProjectKeyAndUserId(projectKey, userId),
      ]);

      const projectName = project ? project.name : `Dự án ${projectKey}`;

      // 3. Chuẩn bị eventId duy nhất (UUID v4)
      eventId = `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

      // 4. Chuẩn bị payload chuẩn schema - BẢO MẬT: Tuyệt đối không gửi token hoặc secret
      const payload = {
        eventId,
        eventType: 'jira.epic.created',
        timestamp: new Date().toISOString(),
        project: {
          id: project?.id || projectId || null,
          name: projectName,
          jiraProjectKey: projectKey.trim().toUpperCase(),
        },
        epic: {
          id: epic.id || null,
          key: epic.key,
          summary: epic.title || epic.summary || `Epic ${epic.key}`,
          description: epic.description ? String(epic.description).slice(0, 300) : '',
          url: epic.url || (config.jira_domain ? `${config.jira_domain.replace(/\/+$/, '')}/browse/${epic.key}` : null),
        },
        actor: {
          id: userId,
          displayName: actor ? actor.name : 'AI Jira Agent User',
        },
        channelConfig: {
          channel,
          targetUrl: targetUrl || null,
          targetEmail: targetEmail || null,
        },
      };

      // 5. Lưu trạng thái pending vào DB trước khi gửi (Idempotency)
      await this.recordEvent({
        eventId,
        eventType: 'jira.epic.created',
        userId,
        projectId: project?.id || projectId || null,
        projectKey,
        epicKey: epic.key,
        epicSummary: payload.epic.summary,
        channel,
        payload,
      });

      console.log(`[NotificationService] Đang phát sự kiện thông báo [${eventId}] sang n8n: ${N8N_NOTIFICATION_WEBHOOK_URL}`);

      // 6. Gửi sang n8n Webhook với shared secret trong header (hỗ trợ tự động fallback /webhook/ và /webhook-test/)
      const response = await postToN8n(N8N_NOTIFICATION_WEBHOOK_URL, payload, {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': NOTIFICATION_WEBHOOK_SECRET,
      }, 15000);

      // 7. Ghi nhận thành công
      await this.markEventSent(eventId, response.data);
      console.log(`[NotificationService] Gửi thông báo [${eventId}] cho Epic ${epic.key} thành công!`);

      return {
        success: true,
        eventId,
        epicKey: epic.key,
        channel,
        data: response.data,
      };
    } catch (error) {
      console.error(`[NotificationService] Lỗi khi gửi thông báo cho Epic ${epic.key}:`, error.message);
      // Ghi nhận lỗi vào DB phục vụ retry nếu đã có eventId
      if (eventId) {
        try {
          await this.markEventFailed(eventId, error.message);
        } catch (e) {
          // Silent catch
        }
      }
      // Không ném lỗi ra ngoài để tránh làm fail Flow 7
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Gửi thông báo thử nghiệm từ trang Cài đặt (Test Notification)
   */
  static async sendTestNotification(userId, customChannel = null) {
    const config = await ConfigModel.findByUserId(userId);
    if (!config) {
      const err = new Error('Bạn chưa có cấu hình hệ thống. Vui lòng lưu cấu hình trước khi thử nghiệm.');
      err.statusCode = 400;
      throw err;
    }

    const channel = customChannel || config.notification_channel || 'discord';
    let targetUrl = null;
    let targetEmail = null;

    if (channel === 'discord') {
      targetUrl = config.discord_webhook_url;
      if (!targetUrl) {
        const err = new Error('Bạn chưa cấu hình Discord Webhook URL. Hãy nhập Webhook URL và lưu trước khi thử.');
        err.statusCode = 400;
        throw err;
      }
    } else if (channel === 'slack') {
      targetUrl = config.slack_webhook_url;
      if (!targetUrl) {
        const err = new Error('Bạn chưa cấu hình Slack Webhook URL. Hãy nhập Webhook URL và lưu trước khi thử.');
        err.statusCode = 400;
        throw err;
      }
    } else if (channel === 'email') {
      targetEmail = config.notification_email || config.jira_email;
      if (!targetEmail) {
        const err = new Error('Bạn chưa cấu hình Email nhận thông báo.');
        err.statusCode = 400;
        throw err;
      }
    }

    const actor = await UserModel.findById(userId);
    const eventId = `test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const payload = {
      eventId,
      eventType: 'jira.epic.created',
      timestamp: new Date().toISOString(),
      isTest: true,
      project: {
        id: null,
        name: 'Dự án Kiểm thử (Demo Workspace)',
        jiraProjectKey: 'DEMO',
      },
      epic: {
        id: '10001',
        key: 'DEMO-101',
        summary: 'Tích hợp Hệ thống Thông báo Tự động (Flow 11)',
        description: 'Đây là thông báo thử nghiệm được gửi từ trang Cài đặt của AI Jira Agent qua cỗ máy n8n.',
        url: config.jira_domain
          ? `${config.jira_domain.replace(/\/+$/, '')}/browse/DEMO-101`
          : 'https://example.atlassian.net/browse/DEMO-101',
      },
      actor: {
        id: userId,
        displayName: actor ? actor.name : 'Người dùng Quản trị',
      },
      channelConfig: {
        channel,
        targetUrl,
        targetEmail,
      },
    };

    // Ghi nhận vào DB
    await this.recordEvent({
      eventId,
      eventType: 'jira.epic.test',
      userId,
      projectId: null,
      projectKey: 'DEMO',
      epicKey: 'DEMO-101',
      epicSummary: payload.epic.summary,
      channel,
      payload,
    });

    try {
      const response = await postToN8n(N8N_NOTIFICATION_WEBHOOK_URL, payload, {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': NOTIFICATION_WEBHOOK_SECRET,
      }, 15000);

      await this.markEventSent(eventId, response.data);

      return {
        success: true,
        eventId,
        channel,
        message: `Đã gửi thông báo thử nghiệm thành công qua kênh ${channel.toUpperCase()}!`,
        data: response.data,
      };
    } catch (error) {
      await this.markEventFailed(eventId, error.message);
      const msg = error.response?.data?.message || error.message || 'Lỗi khi gọi sang n8n webhook thông báo.';
      const err = new Error(`Không thể gửi thông báo thử nghiệm qua n8n: ${msg}`);
      err.statusCode = error.response?.status || 502;
      throw err;
    }
  }
}

module.exports = NotificationService;
