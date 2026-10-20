const axios = require('axios');
const db = require('../config/db');
const ConfigModel = require('../models/config.model');
const ProjectModel = require('../models/project.model');
const UserModel = require('../models/user.model');
const NotificationService = require('../services/notification.service');
const EmailService = require('../services/email.service');

class InternalNotificationController {
  /**
   * MAIN 04: Xác minh sự kiện thông báo với Backend
   * POST /api/internal/notifications/verify-event
   */
  static async verifyEvent(req, res) {
    try {
      const {
        eventId,
        eventType,
        projectKey,
        projectId,
        userId,
        epicKey,
        isTest,
      } = req.body || {};

      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({
          success: false,
          verified: false,
          statusCode: 400,
          error: 'Thiếu eventId hợp lệ trong payload.',
        });
      }

      if (
        !eventType ||
        (!eventType.startsWith('jira.epic.') && eventType !== 'jira.epic.created' && eventType !== 'jira.epic.test')
      ) {
        return res.status(400).json({
          success: false,
          verified: false,
          statusCode: 400,
          error: 'eventType không đúng chuẩn (phải là jira.epic.created hoặc jira.epic.test).',
        });
      }

      if (!epicKey) {
        return res.status(400).json({
          success: false,
          verified: false,
          statusCode: 400,
          error: 'Thiếu epicKey trong payload sự kiện.',
        });
      }

      // Trường hợp Test Notification hoặc Project DEMO
      if (isTest || projectKey === 'DEMO') {
        return res.status(200).json({
          success: true,
          verified: true,
          eventId,
          isTest: true,
          project: {
            id: projectId || null,
            name: 'Dự án Kiểm thử (Demo Workspace)',
            jiraProjectKey: projectKey || 'DEMO',
          },
          message: 'Sự kiện thông báo thử nghiệm đã được Backend xác minh hợp lệ.',
        });
      }

      // Kiểm tra Project trong CSDL
      let project = null;
      if (projectId && userId) {
        project = await ProjectModel.findByIdAndUserId(projectId, userId);
      } else if (projectKey && userId) {
        project = await ProjectModel.findByProjectKeyAndUserId(projectKey, userId);
      } else if (projectId) {
        project = await ProjectModel.findById(projectId);
      } else if (projectKey) {
        const query = 'SELECT * FROM projects WHERE UPPER(project_key) = UPPER($1) LIMIT 1';
        const { rows } = await db.query(query, [projectKey.trim()]);
        project = rows[0] || null;
      }

      if (!project && !isTest) {
        // Nếu không tìm thấy dự án trong CSDL nhưng có projectKey hợp lệ
        if (projectKey && projectKey.length >= 2) {
          return res.status(200).json({
            success: true,
            verified: true,
            eventId,
            isTest: false,
            project: {
              id: projectId || null,
              name: `Dự án ${projectKey}`,
              jiraProjectKey: projectKey.trim().toUpperCase(),
            },
            message: `Sự kiện xác minh hợp lệ cho mã dự án ${projectKey}.`,
          });
        }

        return res.status(404).json({
          success: false,
          verified: false,
          statusCode: 404,
          error: `Dự án với mã '${projectKey}' hoặc ID '${projectId}' không tồn tại trong hệ thống.`,
        });
      }

      return res.status(200).json({
        success: true,
        verified: true,
        eventId,
        isTest: false,
        project: {
          id: project ? project.id : projectId,
          name: project ? project.name : `Dự án ${projectKey}`,
          jiraProjectKey: project ? (project.project_key || projectKey) : projectKey,
        },
        message: 'Sự kiện thông báo Epic Created đã được Backend xác minh thành công.',
      });
    } catch (error) {
      console.error('[InternalNotificationController] Lỗi xác minh sự kiện:', error);
      return res.status(500).json({
        success: false,
        verified: false,
        statusCode: 500,
        error: `Lỗi máy chủ khi xác minh sự kiện: ${error.message}`,
      });
    }
  }

  /**
   * MAIN 05: Lấy cấu hình thông báo an toàn từ Backend (không lộ secret/password)
   * POST /api/internal/notifications/config hoặc GET /api/internal/notifications/config
   */
  static async getConfig(req, res) {
    try {
      const userId = req.body?.userId || req.query?.userId;
      const eventId = req.body?.eventId || req.query?.eventId;
      const projectKey = req.body?.projectKey || req.query?.projectKey;

      let targetUserId = userId;

      // Nếu không có userId trực tiếp, tìm từ notification_events
      if (!targetUserId && eventId) {
        const eventRow = await NotificationService.findByEventId(eventId);
        if (eventRow && eventRow.user_id) {
          targetUserId = eventRow.user_id;
        }
      }

      // Nếu vẫn chưa có, tìm từ project owner
      if (!targetUserId && projectKey) {
        const query = 'SELECT user_id FROM projects WHERE UPPER(project_key) = UPPER($1) LIMIT 1';
        const { rows } = await db.query(query, [projectKey.trim()]);
        if (rows.length > 0 && rows[0].user_id) {
          targetUserId = rows[0].user_id;
        }
      }

      // Nếu vẫn chưa có, lấy người dùng đầu tiên trong hệ thống
      if (!targetUserId) {
        const userRes = await db.query('SELECT id FROM users LIMIT 1');
        if (userRes.rows.length > 0) {
          targetUserId = userRes.rows[0].id;
        }
      }

      if (!targetUserId) {
        return res.status(200).json({
          success: true,
          notification_enabled: false,
          notification_channel: 'discord',
          is_channel_configured: false,
          has_discord: false,
          has_slack: false,
          has_email: false,
          target_email: null,
          jira_domain: null,
          message: 'Không tìm thấy thông tin người dùng để lấy cấu hình.',
        });
      }

      const config = await ConfigModel.findByUserId(targetUserId);

      if (!config) {
        return res.status(200).json({
          success: true,
          userId: targetUserId,
          notification_enabled: false,
          notification_channel: 'discord',
          is_channel_configured: false,
          has_discord: false,
          has_slack: false,
          has_email: false,
          target_email: null,
          jira_domain: null,
          message: 'Người dùng chưa lưu cấu hình thông báo.',
        });
      }

      const channel = (config.notification_channel || 'discord').toLowerCase();
      const hasDiscord = Boolean(config.discord_webhook_url && config.discord_webhook_url.trim().length > 0);
      const hasSlack = Boolean(config.slack_webhook_url && config.slack_webhook_url.trim().length > 0);
      const hasEmail = Boolean((config.notification_email && config.notification_email.trim().length > 0) || config.jira_email);

      let isChannelConfigured = false;
      if (channel === 'discord') isChannelConfigured = hasDiscord;
      else if (channel === 'slack') isChannelConfigured = hasSlack;
      else if (channel === 'email') isChannelConfigured = hasEmail;

      // Trả về các trường an toàn, TUYỆT ĐỐI KHÔNG TRẢ webhook url hoặc SMTP password về n8n
      return res.status(200).json({
        success: true,
        userId: targetUserId,
        notification_enabled: config.notification_enabled !== false,
        notification_channel: channel,
        is_channel_configured: isChannelConfigured,
        has_discord: hasDiscord,
        has_slack: hasSlack,
        has_email: hasEmail,
        target_email: config.notification_email || config.jira_email || null,
        jira_domain: config.jira_domain || null,
      });
    } catch (error) {
      console.error('[InternalNotificationController] Lỗi lấy cấu hình thông báo:', error);
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: `Lỗi máy chủ khi lấy cấu hình: ${error.message}`,
      });
    }
  }

  /**
   * MAIN 07: Atomic Claim Idempotency trên CSDL Backend
   * POST /api/internal/notifications/claim-idempotency
   */
  static async claimIdempotency(req, res) {
    try {
      const {
        eventId,
        eventType = 'jira.epic.created',
        userId,
        projectId,
        projectKey = 'DEFAULT',
        epicKey = 'EPIC',
        epicSummary = '',
        channel = 'discord',
        payload = {},
      } = req.body || {};

      if (!eventId) {
        return res.status(400).json({
          success: false,
          claimed: false,
          statusCode: 400,
          error: 'Thiếu eventId để thực hiện Idempotency claim.',
        });
      }

      // 1. Kiểm tra xem sự kiện đã tồn tại chưa
      const existing = await NotificationService.findByEventId(eventId);

      if (existing) {
        // Nếu đã hoàn thành gửi thành công trước đó
        if (existing.status === 'sent' || existing.status === 'completed') {
          return res.status(200).json({
            success: true,
            claimed: false,
            isDuplicate: true,
            status: 'completed',
            eventId,
            message: 'Sự kiện này đã được xử lý thành công trước đó (Idempotent - Skipped duplicate).',
          });
        }

        // Nếu đang trong tiến trình xử lý gần đây (< 2 phút)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        if (existing.status === 'processing' && existing.updated_at > twoMinutesAgo) {
          return res.status(200).json({
            success: true,
            claimed: false,
            isDuplicate: true,
            status: 'processing',
            eventId,
            message: 'Sự kiện đang được xử lý đồng thời bởi một execution khác.',
          });
        }

        // Nếu ở trạng thái pending hoặc failed (retryable): Cập nhật atomic sang processing
        const updateQuery = `
          UPDATE notification_events
          SET status = 'processing', updated_at = CURRENT_TIMESTAMP
          WHERE event_id = $1
          RETURNING *;
        `;
        const { rows } = await db.query(updateQuery, [eventId]);
        return res.status(200).json({
          success: true,
          claimed: true,
          isDuplicate: false,
          status: 'processing',
          eventId,
          message: 'Đã nhận quyền xử lý sự kiện (Claimed for processing).',
        });
      }

      // 2. Nếu chưa có bản ghi: Thực hiện Atomic Insert với status = 'processing'
      const insertQuery = `
        INSERT INTO notification_events (
          event_id, event_type, user_id, project_id, project_key,
          epic_key, epic_summary, channel, status, payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing', $9)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING *;
      `;
      const values = [
        eventId,
        eventType,
        userId || null,
        projectId || null,
        String(projectKey).trim().toUpperCase(),
        String(epicKey).trim().toUpperCase(),
        String(epicSummary).slice(0, 500),
        channel,
        JSON.stringify(payload),
      ];

      const { rows } = await db.query(insertQuery, values);

      if (rows.length > 0) {
        return res.status(200).json({
          success: true,
          claimed: true,
          isDuplicate: false,
          status: 'processing',
          eventId,
          message: 'Tạo mới bản ghi và nhận quyền xử lý sự kiện thành công.',
        });
      }

      // Xung đột đồng thời (Race condition): một worker khác vừa insert cùng microsecond
      const raceRow = await NotificationService.findByEventId(eventId);
      return res.status(200).json({
        success: true,
        claimed: false,
        isDuplicate: true,
        status: raceRow ? raceRow.status : 'duplicate',
        eventId,
        message: 'Phát hiện xung đột đồng thời: Sự kiện đã được nhận bởi tiến trình khác.',
      });
    } catch (error) {
      console.error('[InternalNotificationController] Lỗi Idempotency claim:', error);
      return res.status(500).json({
        success: false,
        claimed: false,
        statusCode: 500,
        error: `Lỗi máy chủ khi claim idempotency: ${error.message}`,
      });
    }
  }

  /**
   * MAIN 10: Thực hiện gửi thông báo thực tế (Gmail SMTP, Discord, Slack) qua Backend
   * POST /api/internal/notifications/dispatch
   */
  static async dispatch(req, res) {
    try {
      const {
        eventId,
        channel,
        formattedMessage,
        userId,
        isTest,
        targetEmailOverride,
      } = req.body || {};

      if (!eventId) {
        return res.status(400).json({
          success: false,
          delivered: false,
          statusCode: 400,
          error: 'Thiếu eventId trong yêu cầu dispatch.',
        });
      }

      const activeChannel = (channel || 'discord').toLowerCase();

      // Lấy cấu hình bảo mật từ CSDL của người dùng
      let config = null;
      if (userId) {
        config = await ConfigModel.findByUserId(userId);
      }
      if (!config) {
        const userRes = await db.query('SELECT id FROM users LIMIT 1');
        if (userRes.rows.length > 0) {
          config = await ConfigModel.findByUserId(userRes.rows[0].id);
        }
      }

      console.log(`[InternalNotificationController] Bắt đầu dispatch thông báo [${eventId}] qua kênh: ${activeChannel.toUpperCase()}`);

      // 1. Kênh DISCORD WEBHOOK
      if (activeChannel === 'discord') {
        const webhookUrl = req.body.targetUrl || req.body.webhookUrl || config?.discord_webhook_url;
        if (!webhookUrl) {
          return res.status(400).json({
            success: false,
            delivered: false,
            statusCode: 400,
            error: 'Chưa cấu hình Discord Webhook URL trong cài đặt hệ thống.',
          });
        }

        // Nếu là URL giả lập hoặc test môi trường không gửi thật
        if (
          webhookUrl.includes('mock') ||
          webhookUrl.includes('example.com') ||
          webhookUrl.includes('test') ||
          webhookUrl.startsWith('test://')
        ) {
          console.log(`[InternalNotificationController] Giả lập Discord dispatch thành công cho [${eventId}]`);
          return res.status(200).json({
            success: true,
            delivered: true,
            channel: 'discord',
            eventId,
            statusCode: 200,
            note: 'Mock delivery to simulation webhook completed.',
          });
        }

        try {
          const discordPayload = formattedMessage || {
            content: `🎉 New Jira Epic Created: Event ${eventId}`,
          };
          const response = await axios.post(webhookUrl, discordPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          });

          return res.status(200).json({
            success: true,
            delivered: true,
            channel: 'discord',
            eventId,
            statusCode: response.status,
            data: response.data || null,
          });
        } catch (postErr) {
          const errMsg = postErr.response?.data?.message || postErr.message;
          console.error(`[InternalNotificationController] Lỗi gửi Discord webhook [${eventId}]:`, errMsg);
          return res.status(502).json({
            success: false,
            delivered: false,
            channel: 'discord',
            eventId,
            statusCode: 502,
            error: `Discord Webhook Error: ${errMsg}`,
          });
        }
      }

      // 2. Kênh SLACK WEBHOOK
      if (activeChannel === 'slack') {
        const webhookUrl = req.body.targetUrl || req.body.webhookUrl || config?.slack_webhook_url;
        if (!webhookUrl) {
          return res.status(400).json({
            success: false,
            delivered: false,
            statusCode: 400,
            error: 'Chưa cấu hình Slack Webhook URL trong cài đặt hệ thống.',
          });
        }

        if (
          webhookUrl.includes('mock') ||
          webhookUrl.includes('example.com') ||
          webhookUrl.includes('test') ||
          webhookUrl.startsWith('test://')
        ) {
          console.log(`[InternalNotificationController] Giả lập Slack dispatch thành công cho [${eventId}]`);
          return res.status(200).json({
            success: true,
            delivered: true,
            channel: 'slack',
            eventId,
            statusCode: 200,
            note: 'Mock delivery to simulation webhook completed.',
          });
        }

        try {
          const slackPayload = formattedMessage || {
            text: `🎉 New Jira Epic Created: Event ${eventId}`,
          };
          const response = await axios.post(webhookUrl, slackPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          });

          return res.status(200).json({
            success: true,
            delivered: true,
            channel: 'slack',
            eventId,
            statusCode: response.status,
            data: response.data || null,
          });
        } catch (postErr) {
          const errMsg = postErr.response?.data?.message || postErr.message;
          console.error(`[InternalNotificationController] Lỗi gửi Slack webhook [${eventId}]:`, errMsg);
          return res.status(502).json({
            success: false,
            delivered: false,
            channel: 'slack',
            eventId,
            statusCode: 502,
            error: `Slack Webhook Error: ${errMsg}`,
          });
        }
      }

      // 3. Kênh GMAIL SMTP
      if (activeChannel === 'email') {
        const toEmail =
          targetEmailOverride ||
          formattedMessage?.to ||
          config?.notification_email ||
          config?.jira_email;

        if (!toEmail) {
          return res.status(400).json({
            success: false,
            delivered: false,
            statusCode: 400,
            error: 'Chưa cấu hình địa chỉ Email nhận thông báo.',
          });
        }

        const emailResult = await EmailService.sendEmail({
          to: toEmail,
          subject: formattedMessage?.subject || `[AI Jira Agent] 🎉 Thông báo Epic mới [${eventId}]`,
          html: formattedMessage?.html || `<p>Thông báo sự kiện Epic mới từ AI Jira Agent. Event ID: ${eventId}</p>`,
          text: formattedMessage?.text || `Thông báo Epic mới. Event ID: ${eventId}`,
        });

        if (!emailResult.success) {
          console.error(`[InternalNotificationController] Gửi email SMTP thất bại cho [${eventId}]:`, emailResult.error);
          return res.status(emailResult.statusCode || 502).json({
            success: false,
            delivered: false,
            channel: 'email',
            eventId,
            statusCode: emailResult.statusCode || 502,
            error: `SMTP Error: ${emailResult.error}`,
          });
        }

        return res.status(200).json({
          success: true,
          delivered: true,
          channel: 'email',
          eventId,
          statusCode: 200,
          deliveryDetails: emailResult,
          message: `Đã gửi email thông báo thành công tới ${toEmail} qua máy chủ SMTP.`,
        });
      }

      return res.status(400).json({
        success: false,
        delivered: false,
        statusCode: 400,
        error: `Kênh thông báo '${activeChannel}' không được hỗ trợ.`,
      });
    } catch (error) {
      console.error('[InternalNotificationController] Lỗi không xử lý được khi dispatch:', error);
      return res.status(500).json({
        success: false,
        delivered: false,
        statusCode: 500,
        error: `Lỗi máy chủ khi dispatch thông báo: ${error.message}`,
      });
    }
  }

  /**
   * MAIN 11: Lưu kết quả cuối cùng của sự kiện thông báo vào CSDL
   * POST /api/internal/notifications/finalize
   */
  static async finalize(req, res) {
    try {
      const {
        eventId,
        status = 'sent',
        responseData = {},
        errorMessage = null,
        channel,
        epicKey,
        jiraUrl,
        skipReason,
      } = req.body || {};

      if (!eventId) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'Thiếu eventId để finalize kết quả.',
        });
      }

      console.log(`[InternalNotificationController] Finalize sự kiện [${eventId}] với status: ${status.toUpperCase()}`);

      if (status === 'sent') {
        const updated = await NotificationService.markEventSent(eventId, responseData);
        return res.status(200).json({
          success: true,
          eventId,
          status: 'sent',
          channel,
          epicKey,
          jiraUrl,
          deliveryDetails: responseData,
          finalized: true,
          record: updated,
        });
      }

      if (status === 'failed') {
        const updated = await NotificationService.markEventFailed(eventId, errorMessage || 'Unknown delivery failure');
        return res.status(200).json({
          success: true,
          eventId,
          status: 'failed',
          channel,
          epicKey,
          jiraUrl,
          errorMessage,
          finalized: true,
          record: updated,
        });
      }

      // Trạng thái skipped hoặc duplicate_skipped
      const updateQuery = `
        UPDATE notification_events
        SET
          status = $1,
          response_data = $2,
          error_message = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE event_id = $4
        RETURNING *;
      `;
      const { rows } = await db.query(updateQuery, [
        status,
        JSON.stringify(responseData),
        errorMessage || skipReason ? String(errorMessage || skipReason) : null,
        eventId,
      ]);

      return res.status(200).json({
        success: true,
        eventId,
        status,
        channel,
        epicKey,
        jiraUrl,
        skipReason,
        finalized: true,
        record: rows[0] || null,
      });
    } catch (error) {
      console.error('[InternalNotificationController] Lỗi finalize kết quả:', error);
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: `Lỗi máy chủ khi finalize kết quả thông báo: ${error.message}`,
      });
    }
  }
}

module.exports = InternalNotificationController;
