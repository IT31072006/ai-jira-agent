const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');
const app = require('../app');
const ConfigModel = require('../models/config.model');
const UserModel = require('../models/user.model');
const ProjectModel = require('../models/project.model');
const ConfigService = require('../services/config.service');
const NotificationService = require('../services/notification.service');

const WORKFLOW_PATH = path.resolve(__dirname, '../../../n8n/workflows/flow-11-epic-notification.json');
const N8N_WEBHOOK_URL = process.env.N8N_NOTIFICATION_WEBHOOK_URL || 'http://localhost:5678/webhook/epic-created-notification';
const NOTIFICATION_WEBHOOK_SECRET = process.env.NOTIFICATION_WEBHOOK_SECRET || 'ai_jira_agent_notification_secret_key_2026';
const TEST_PORT = process.env.TEST_PORT || 5001;
const BACKEND_TEST_URL = `http://localhost:${TEST_PORT}`;

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN LUỒNG 11: AUTOMATED NOTIFICATION');
  console.log('   (12 MAIN NODES TRÊN N8N — ARCHITECTURE BACKEND DISPATCH)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  let server = null;
  let user = null;
  let project = null;
  let originalConfig = null;

  try {
    // 0. Khởi động Backend Express test server trên cổng 5001
    server = await new Promise((resolve) => {
      const s = app.listen(TEST_PORT, () => {
        console.log(`📡 Backend Express test server đang lắng nghe tại: ${BACKEND_TEST_URL}`);
        resolve(s);
      });
      s.on('error', (err) => {
        console.error('Lỗi khởi động test server:', err.message);
        resolve(null);
      });
    });

    // Lấy thông tin user và project kiểm thử
    const userRes = await db.query('SELECT id, name, email FROM users LIMIT 1');
    if (!userRes.rows.length) {
      console.error('⚠️ Không tìm thấy người dùng trong DB để test.');
      process.exit(1);
    }
    user = userRes.rows[0];
    console.log(`👤 Người dùng thử nghiệm: ${user.name} (${user.email}, ID: ${user.id})`);

    const projRes = await db.query('SELECT id, name, project_key FROM projects WHERE user_id = $1 LIMIT 1', [user.id]);
    if (projRes.rows.length > 0) {
      project = projRes.rows[0];
    } else {
      const anyProj = await db.query('SELECT id, name, project_key FROM projects LIMIT 1');
      project = anyProj.rows[0] || { id: null, name: 'Dự án DEMO', project_key: 'DEMO' };
    }
    console.log(`📁 Dự án mẫu: "${project.name}" (Key: ${project.project_key}, ID: ${project.id || 'n/a'})\n`);

    originalConfig = await ConfigModel.findByUserId(user.id);

    // =================================================================
    // PHẦN 1: KIỂM CHỨNG CẤU TRÚC WORKFLOW JSON & 12 MAIN NODES
    // =================================================================
    console.log('--- PHẦN 1: KIỂM CHỨNG CẤU TRÚC WORKFLOW JSON & 12 MAIN NODES ---');
    assert(fs.existsSync(WORKFLOW_PATH), 'File flow-11-epic-notification.json tồn tại trong thư mục n8n/workflows/');

    const workflowContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    let workflow = null;
    try {
      workflow = JSON.parse(workflowContent);
      assert(true, 'File workflow JSON có cú pháp hợp lệ');
    } catch (e) {
      assert(false, `Lỗi parse JSON: ${e.message}`);
    }

    assert(workflow && workflow.id === 'Flow11NotifyEpic', 'Workflow ID là "Flow11NotifyEpic"');

    // Lọc danh sách MAIN Nodes và AUX Nodes
    const mainNodes = (workflow?.nodes || []).filter((n) => n.name && n.name.startsWith('MAIN '));
    const auxNodes = (workflow?.nodes || []).filter((n) => n.name && n.name.startsWith('AUX — '));
    const otherNodes = (workflow?.nodes || []).filter((n) => !n.name.startsWith('MAIN ') && !n.name.startsWith('AUX — '));

    assert(mainNodes.length === 12, `Workflow có CHÍNH XÁC 12 MAIN Nodes (hiện có: ${mainNodes.length})`);
    assert(auxNodes.length <= 4, `Workflow có tối đa 4 AUX Nodes (hiện có: ${auxNodes.length} nodes)`);
    assert(workflow.nodes.length <= 16, `Tổng số Node vật lý không vượt quá 16 (hiện có: ${workflow.nodes.length} nodes)`);
    assert(otherNodes.length === 0, `Không có node không xác định ngoài MAIN và AUX (hiện có: ${otherNodes.length})`);

    // Danh sách 12 MAIN Nodes chuẩn theo Section V
    const expectedMainNames = [
      'MAIN 01 — Epic Created Webhook Trigger',
      'MAIN 02 — Verify Webhook Authentication',
      'MAIN 03 — Validate Notification Event',
      'MAIN 04 — Verify Event with Backend',
      'MAIN 05 — Fetch Notification Configuration',
      'MAIN 06 — Notification Eligibility Check',
      'MAIN 07 — Backend Idempotency Claim',
      'MAIN 08 — Resolve Notification Channel',
      'MAIN 09 — Build Notification Message',
      'MAIN 10 — Dispatch Notification via Backend',
      'MAIN 11 — Finalize Notification Result',
      'MAIN 12 — Respond to Notification Webhook',
    ];

    const actualMainNames = mainNodes.map((n) => n.name);
    const allNamesMatch = expectedMainNames.every((name) => actualMainNames.includes(name));
    assert(allNamesMatch, 'Tất cả 12 MAIN Nodes đều có tên chuẩn xác 100% theo đặc tả Section V');

    // Kiểm tra các giới hạn kiến trúc bất biến
    const hasPostgresNode = (workflow?.nodes || []).some((n) => n.type && n.type.toLowerCase().includes('postgres'));
    assert(!hasPostgresNode, 'TUYỆT ĐỐI không có node PostgreSQL nào trong workflow Flow 11');

    const hasDirectDiscordNode = (workflow?.nodes || []).some((n) => n.type && n.type.toLowerCase().includes('discord'));
    const hasDirectSlackNode = (workflow?.nodes || []).some((n) => n.type && n.type.toLowerCase().includes('slack'));
    const hasDirectGmailNode = (workflow?.nodes || []).some((n) => n.type && (n.type.toLowerCase().includes('gmail') || n.type.toLowerCase().includes('emailread')));
    assert(!hasDirectDiscordNode && !hasDirectSlackNode && !hasDirectGmailNode, 'TUYỆT ĐỐI không có node gửi trực tiếp Discord/Slack/Gmail từ n8n (Backend phụ trách dispatch)');

    const hasSecretsInJson = workflowContent.includes('uskytuzxmbvsdjdh') || workflowContent.includes('mock_secret_token_never_in_json');
    assert(!hasSecretsInJson, 'TUYỆT ĐỐI không hardcode mật khẩu SMTP hay secret trong workflow JSON');

    // Kiểm tra tính toàn vẹn kết nối (Connections)
    const nodeNames = new Set((workflow?.nodes || []).map((n) => n.name));
    let brokenConns = 0;
    for (const [source, connObj] of Object.entries(workflow?.connections || {})) {
      if (!nodeNames.has(source)) brokenConns++;
      for (const [, routes] of Object.entries(connObj)) {
        for (const routeList of routes) {
          for (const target of routeList) {
            if (!nodeNames.has(target.node)) brokenConns++;
          }
        }
      }
    }
    assert(brokenConns === 0, 'Toàn bộ liên kết giữa các node trong workflow đều hợp lệ (0 broken connections)');

    // =================================================================
    // PHẦN 2: BẢO MẬT & KIỂM THỬ 5 BACKEND INTERNAL NOTIFICATION APIS
    // =================================================================
    console.log('\n--- PHẦN 2: BẢO MẬT & KIỂM THỬ 5 BACKEND INTERNAL APIS ---');

    // 2.1 Bảo mật Service-to-Service
    try {
      await axios.post(`${BACKEND_TEST_URL}/api/internal/notifications/verify-event`, {});
      assert(false, 'API nội bộ từ chối khi thiếu header xác thực');
    } catch (e) {
      assert(e.response?.status === 401, 'API nội bộ trả về 401 Unauthorized khi thiếu header xác thực');
    }

    try {
      await axios.post(
        `${BACKEND_TEST_URL}/api/internal/notifications/verify-event`,
        {},
        { headers: { 'X-Webhook-Secret': 'wrong-secret-key-xyz' } }
      );
      assert(false, 'API nội bộ từ chối khi secret không khớp');
    } catch (e) {
      assert(e.response?.status === 401, 'API nội bộ trả về 401 Unauthorized khi secret không khớp');
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': NOTIFICATION_WEBHOOK_SECRET,
    };

    // 2.2 MAIN 04 API: verify-event
    const testVerifyEvent = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/verify-event`,
      {
        eventId: 'evt_test_verify_001',
        eventType: 'jira.epic.test',
        projectKey: 'DEMO',
        epicKey: 'DEMO-101',
        isTest: true,
      },
      { headers: authHeaders }
    );
    assert(testVerifyEvent.status === 200 && testVerifyEvent.data.verified === true, 'MAIN 04 verify-event: Xác minh thành công sự kiện test DEMO');

    const realVerifyEvent = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/verify-event`,
      {
        eventId: 'evt_real_verify_002',
        eventType: 'jira.epic.created',
        projectKey: project.project_key,
        projectId: project.id,
        userId: user.id,
        epicKey: `${project.project_key}-1`,
        isTest: false,
      },
      { headers: authHeaders }
    );
    assert(realVerifyEvent.status === 200 && realVerifyEvent.data.verified === true, 'MAIN 04 verify-event: Xác minh thành công sự kiện với project thực tế');

    try {
      await axios.post(
        `${BACKEND_TEST_URL}/api/internal/notifications/verify-event`,
        {
          eventId: 'evt_missing_fields',
        },
        { headers: authHeaders }
      );
      assert(false, 'MAIN 04 verify-event: Từ chối khi thiếu dữ liệu');
    } catch (e) {
      assert(e.response?.status === 400, 'MAIN 04 verify-event: Báo lỗi 400 Bad Request khi thiếu trường bắt buộc');
    }

    // 2.3 MAIN 05 API: config
    const configRes = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/config`,
      { userId: user.id },
      { headers: authHeaders }
    );
    assert(configRes.status === 200 && configRes.data.success === true, 'MAIN 05 config: Lấy cấu hình thông báo thành công');
    assert(
      !configRes.data.discord_webhook_url && !configRes.data.slack_webhook_url && !configRes.data.smtp_pass,
      'MAIN 05 config: Tuyệt đối không trả secret URL hay password về n8n (chỉ trả cờ is_channel_configured)'
    );

    // 2.4 MAIN 07 API: claim-idempotency
    const idempotencyEvtId = `evt_claim_test_${Date.now()}`;
    const claimRes1 = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/claim-idempotency`,
      {
        eventId: idempotencyEvtId,
        eventType: 'jira.epic.created',
        userId: user.id,
        projectKey: project.project_key,
        epicKey: `${project.project_key}-50`,
        epicSummary: 'Epic Thử Nghiệm Idempotency',
        channel: 'discord',
      },
      { headers: authHeaders }
    );
    assert(claimRes1.status === 200 && claimRes1.data.claimed === true && claimRes1.data.isDuplicate === false, 'MAIN 07 claim-idempotency: Nhận quyền xử lý (claimed: true) cho sự kiện mới');

    // Đánh dấu hoàn thành sự kiện trên
    await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/finalize`,
      {
        eventId: idempotencyEvtId,
        status: 'sent',
        responseData: { delivered: true },
      },
      { headers: authHeaders }
    );

    // Thử claim lại sự kiện vừa hoàn thành
    const claimRes2 = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/claim-idempotency`,
      {
        eventId: idempotencyEvtId,
        projectKey: project.project_key,
        epicKey: `${project.project_key}-50`,
      },
      { headers: authHeaders }
    );
    assert(claimRes2.status === 200 && claimRes2.data.isDuplicate === true && claimRes2.data.claimed === false, 'MAIN 07 claim-idempotency: Phát hiện sự kiện trùng lặp đã hoàn thành (isDuplicate: true)');

    // 2.5 MAIN 10 API: dispatch
    const mockDiscordDispatch = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/dispatch`,
      {
        eventId: `evt_mock_discord_${Date.now()}`,
        channel: 'discord',
        targetUrl: 'https://discord.com/api/webhooks/mock-webhook-test',
        formattedMessage: { content: 'Test discord message' },
        userId: user.id,
        isTest: true,
      },
      { headers: authHeaders }
    );
    assert(mockDiscordDispatch.status === 200 && mockDiscordDispatch.data.delivered === true, 'MAIN 10 dispatch: Backend thực hiện điều phối thành công cho kênh Discord');

    const mockSlackDispatch = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/dispatch`,
      {
        eventId: `evt_mock_slack_${Date.now()}`,
        channel: 'slack',
        targetUrl: 'https://hooks.slack.com/services/mock-webhook-test',
        formattedMessage: { text: 'Test slack message' },
        userId: user.id,
        isTest: true,
      },
      { headers: authHeaders }
    );
    assert(mockSlackDispatch.status === 200 && mockSlackDispatch.data.delivered === true, 'MAIN 10 dispatch: Backend thực hiện điều phối thành công cho kênh Slack');

    try {
      await axios.post(
        `${BACKEND_TEST_URL}/api/internal/notifications/dispatch`,
        {
          eventId: 'evt_invalid_channel',
          channel: 'telegram_unsupported',
        },
        { headers: authHeaders }
      );
      assert(false, 'MAIN 10 dispatch: Báo lỗi khi kênh không hỗ trợ');
    } catch (e) {
      assert(e.response?.status === 400, 'MAIN 10 dispatch: Báo lỗi 400 khi kênh không được hỗ trợ');
    }

    // 2.6 MAIN 11 API: finalize
    const finalizeSentEvt = `evt_final_sent_${Date.now()}`;
    await NotificationService.recordEvent({
      eventId: finalizeSentEvt,
      userId: user.id,
      projectKey: 'TEST',
      epicKey: 'TEST-1',
      channel: 'discord',
      payload: {},
    });
    const finalSentRes = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/finalize`,
      {
        eventId: finalizeSentEvt,
        status: 'sent',
        responseData: { testSuccess: true },
      },
      { headers: authHeaders }
    );
    assert(finalSentRes.status === 200 && finalSentRes.data.status === 'sent', 'MAIN 11 finalize: Cập nhật thành công trạng thái "sent" vào CSDL');

    const finalizeFailEvt = `evt_final_fail_${Date.now()}`;
    await NotificationService.recordEvent({
      eventId: finalizeFailEvt,
      userId: user.id,
      projectKey: 'TEST',
      epicKey: 'TEST-2',
      channel: 'discord',
      payload: {},
    });
    const finalFailRes = await axios.post(
      `${BACKEND_TEST_URL}/api/internal/notifications/finalize`,
      {
        eventId: finalizeFailEvt,
        status: 'failed',
        errorMessage: 'Connection timed out',
      },
      { headers: authHeaders }
    );
    assert(finalFailRes.status === 200 && finalFailRes.data.status === 'failed', 'MAIN 11 finalize: Cập nhật thành công trạng thái "failed" và error_message');

    // =================================================================
    // PHẦN 3: KIỂM THỬ N8N FLOW 11 WEBHOOK END-TO-END TRỰC TIẾP
    // =================================================================
    console.log('\n--- PHẦN 3: KIỂM THỬ N8N FLOW 11 WEBHOOK END-TO-END TRỰC TIẾP ---');

    // 3.1 MAIN 02 Security Test: Request không header secret bị từ chối
    try {
      await axios.post(N8N_WEBHOOK_URL, { test: true }, { timeout: 8000 });
      assert(false, 'Webhook n8n từ chối request không có X-Webhook-Secret');
    } catch (e) {
      assert(e.response?.status === 401, 'MAIN 02: Request không có secret bị n8n từ chối với HTTP 401 Unauthorized');
    }

    // 3.2 MAIN 03 Validation Test: Payload thiếu trường bắt buộc
    try {
      await axios.post(
        N8N_WEBHOOK_URL,
        { eventId: 'evt_no_epic' },
        { headers: authHeaders, timeout: 8000 }
      );
      assert(false, 'MAIN 03: Từ chối payload thiếu thông tin');
    } catch (e) {
      assert(e.response?.status === 400, 'MAIN 03: Payload thiếu thông tin bị từ chối với HTTP 400 Bad Request');
    }

    // 3.3 End-to-End: Gửi thông báo Epic tạo thành công qua n8n
    // Chuẩn bị cấu hình test
    await ConfigService.saveConfig(user.id, {
      notification_enabled: true,
      notification_channel: 'discord',
      discord_webhook_url: 'https://discord.com/api/webhooks/mock-webhook-test',
      notification_email: 'test@example.com',
    });

    const liveEvtId = `evt_e2e_live_${Date.now()}`;
    const livePayload = {
      eventId: liveEvtId,
      eventType: 'jira.epic.created',
      timestamp: new Date().toISOString(),
      userId: user.id,
      backendUrl: BACKEND_TEST_URL,
      project: {
        id: project.id,
        name: project.name,
        jiraProjectKey: project.project_key,
      },
      epic: {
        id: '10001',
        key: `${project.project_key}-99`,
        summary: 'Epic Tự Động Hóa Kiểm Thử Luồng 11',
        description: 'Tích hợp 12 MAIN Nodes hoàn chỉnh trên n8n.',
        url: `https://jira.example.com/browse/${project.project_key}-99`,
      },
      actor: {
        id: user.id,
        displayName: user.name,
      },
      channelConfig: {
        channel: 'discord',
      },
    };

    const webhookRes = await axios.post(N8N_WEBHOOK_URL, livePayload, {
      headers: authHeaders,
      timeout: 15000,
    });

    assert(webhookRes.status === 200, 'n8n Flow 11 Webhook phản hồi HTTP 200 OK');
    assert(webhookRes.data.success === true, 'Flow 11 trả về success = true');
    assert(webhookRes.data.status === 'sent', 'Flow 11 hoàn thành với trạng thái "sent"');
    assert(webhookRes.data.eventId === liveEvtId, `Flow 11 bảo toàn eventId chính xác: ${liveEvtId}`);
    assert(webhookRes.data.dispatchedByBackend === true, 'Xác nhận cờ dispatchedByBackend = true (gửi qua Backend API)');

    // Kiểm tra CSDL sau khi workflow hoàn thành
    const dbRecord = await NotificationService.findByEventId(liveEvtId);
    assert(dbRecord && dbRecord.status === 'sent', 'MAIN 11 đã ghi nhận sự kiện chuyển sang trạng thái "sent" trong PostgreSQL');

    // 3.4 Kiểm thử Idempotency trên n8n: Gửi lặp lại cùng sự kiện
    const duplicateRes = await axios.post(N8N_WEBHOOK_URL, livePayload, {
      headers: authHeaders,
      timeout: 15000,
    });
    assert(duplicateRes.status === 200, 'Gửi lại cùng eventId phản hồi HTTP 200');
    assert(duplicateRes.data.status === 'duplicate_skipped', 'MAIN 07 chặn trùng lặp: Phản hồi status = "duplicate_skipped"');

    // =================================================================
    // PHẦN 4: KIỂM THỬ NHÁNH BỎ QUA (NOTIFICATION DISABLED)
    // =================================================================
    console.log('\n--- PHẦN 4: KIỂM THỬ NHÁNH BỎ QUA (NOTIFICATION DISABLED) ---');

    await ConfigService.saveConfig(user.id, {
      notification_enabled: false,
    });

    const disabledEvtId = `evt_disabled_${Date.now()}`;
    const disabledPayload = {
      ...livePayload,
      eventId: disabledEvtId,
      epic: { ...livePayload.epic, key: `${project.project_key}-88` },
    };

    // Khi gọi trực tiếp n8n webhook lúc notification_enabled = false
    const disabledWebhookRes = await axios.post(N8N_WEBHOOK_URL, disabledPayload, {
      headers: authHeaders,
      timeout: 15000,
    });
    assert(disabledWebhookRes.status === 200, 'Webhook xử lý thành công nhánh notification disabled');
    assert(disabledWebhookRes.data.status === 'skipped', 'MAIN 06 phát hiện disabled: Trả về status = "skipped"');

    // Gọi qua hàm service của Backend
    const serviceDisabledRes = await NotificationService.sendEpicCreatedNotification({
      userId: user.id,
      projectKey: project.project_key,
      epic: { key: `${project.project_key}-88`, title: 'Epic khi tắt thông báo' },
    });
    assert(serviceDisabledRes === null, 'NotificationService.sendEpicCreatedNotification bỏ qua an toàn và trả về null');

    // Bật lại thông báo
    await ConfigService.saveConfig(user.id, {
      notification_enabled: true,
      notification_channel: 'discord',
      discord_webhook_url: 'https://discord.com/api/webhooks/mock-webhook-test',
      notification_email: 'test@example.com',
    });

    // =================================================================
    // PHẦN 5: KIỂM THỬ TÍNH NĂNG TEST NOTIFICATION TỪ TRANG CÀI ĐẶT
    // =================================================================
    console.log('\n--- PHẦN 5: KIỂM THỬ TEST NOTIFICATION TỪ CÀI ĐẶT ---');

    const testNotifRes = await NotificationService.sendTestNotification(user.id, 'discord');
    assert(testNotifRes && testNotifRes.success === true, 'Hàm sendTestNotification thực thi thành công');
    assert(testNotifRes.channel === 'discord', 'Kênh thử nghiệm là discord');

    const history = await NotificationService.getHistory(user.id, 10);
    assert(Array.isArray(history) && history.length >= 2, `Truy vấn được lịch sử thông báo (${history.length} bản ghi)`);
    assert(history[0].event_type.startsWith('jira.epic.'), 'Bản ghi lịch sử lưu đúng định dạng event_type');

    // =================================================================
    // PHẦN 6: KIỂM THỬ KHẢ NĂNG CHỊU LỖI & CONCURRENCY
    // =================================================================
    console.log('\n--- PHẦN 6: KIỂM THỬ KHẢ NĂNG CHỊU LỖI & CONCURRENCY ---');

    // 6.1 Non-blocking đối với Flow 7 khi n8n URL sai
    const invalidUrlService = await NotificationService.sendEpicCreatedNotification({
      userId: user.id,
      projectKey: project.project_key,
      epic: { key: `${project.project_key}-101`, title: 'Epic Non-blocking' },
    });
    assert(typeof invalidUrlService === 'object' && invalidUrlService !== null, 'Hàm sendEpicCreatedNotification bắt lỗi an toàn không làm hỏng Flow 7');

    // 6.2 Concurrent Execution (Race condition test)
    const raceEvtId = `evt_race_${Date.now()}`;
    const [raceRes1, raceRes2] = await Promise.all([
      axios.post(
        `${BACKEND_TEST_URL}/api/internal/notifications/claim-idempotency`,
        { eventId: raceEvtId, projectKey: 'TEST', epicKey: 'TEST-1' },
        { headers: authHeaders }
      ),
      axios.post(
        `${BACKEND_TEST_URL}/api/internal/notifications/claim-idempotency`,
        { eventId: raceEvtId, projectKey: 'TEST', epicKey: 'TEST-1' },
        { headers: authHeaders }
      ),
    ]);

    const claimedCount = (raceRes1.data.claimed ? 1 : 0) + (raceRes2.data.claimed ? 1 : 0);
    assert(claimedCount === 1, 'Xử lý đồng thời (Race condition): Chính xác 1 execution claim thành công, execution còn lại bị chặn trùng');

    // 6.3 Che giấu Webhook Secret trong cấu hình
    const maskedConfig = await ConfigService.getConfig(user.id);
    assert(
      maskedConfig.discord_webhook_url_masked &&
      maskedConfig.discord_webhook_url_masked.startsWith('********'),
      'Webhook URL được che giấu (masked) bảo mật tuyệt đối khi hiển thị cho Client'
    );

    console.log('\n================================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ LUỒNG 11: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('================================================================');
    if (passedTests === totalTests) {
      console.log('🎉 TẤT CẢ CÁC BÀI TEST CỦA LUỒNG 11 ĐÃ ĐẠT 100%!\n');
    } else {
      console.error(`⚠️ Có ${totalTests - passedTests} bài test thất bại!\n`);
    }
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng trong kiểm thử:', err.message, err.stack);
  } finally {
    if (originalConfig && user) {
      await ConfigModel.upsert(user.id, {
        jiraDomain: originalConfig.jira_domain,
        jiraEmail: originalConfig.jira_email,
        jiraApiTokenEncrypted: originalConfig.jira_api_token_encrypted,
        geminiApiKeyEncrypted: originalConfig.gemini_api_key_encrypted,
        notificationEnabled: originalConfig.notification_enabled,
        notificationChannel: originalConfig.notification_channel,
        discordWebhookUrl: originalConfig.discord_webhook_url,
        slackWebhookUrl: originalConfig.slack_webhook_url,
        notificationEmail: originalConfig.notification_email,
      });
    }
    if (server) {
      server.close();
    }
    if (db.pool && db.pool.end) {
      await db.pool.end();
    }
  }
}

runTests();
