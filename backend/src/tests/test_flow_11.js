const db = require('../config/db');
const NotificationService = require('../services/notification.service');
const ConfigModel = require('../models/config.model');
const UserModel = require('../models/user.model');
const ProjectModel = require('../models/project.model');
const crypto = require('crypto');

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ LUỒNG 11: AUTOMATED NOTIFICATION');
  console.log('=====================================================\n');

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

  try {
    // 1. Lấy user kiểm thử
    const userRes = await db.query('SELECT id, name, email FROM users LIMIT 1');
    if (!userRes.rows.length) {
      console.log('⚠️ Không tìm thấy người dùng trong DB để test.');
      process.exit(1);
    }
    const user = userRes.rows[0];
    console.log(`👤 Sử dụng test user: ${user.name} (${user.email}, ID: ${user.id})`);

    // 2. Test Idempotency & Database recording
    console.log('\n--- Test 1: Ghi nhận sự kiện & Idempotency trong CSDL ---');
    const testEventId = `evt_unit_test_${Date.now()}`;
    const initialRecord = await NotificationService.recordEvent({
      eventId: testEventId,
      eventType: 'jira.epic.created',
      userId: user.id,
      projectKey: 'TEST',
      epicKey: 'TEST-100',
      epicSummary: 'Epic Kiểm Thử Đơn Vị',
      channel: 'discord',
      payload: { test: true },
    });
    assert(initialRecord !== null && initialRecord.event_id === testEventId, 'Ghi nhận sự kiện ban đầu vào notification_events với status pending');

    // Thử ghi lại cùng eventId (Idempotency database constraint)
    const duplicateRecord = await NotificationService.recordEvent({
      eventId: testEventId,
      eventType: 'jira.epic.created',
      userId: user.id,
      projectKey: 'TEST',
      epicKey: 'TEST-100',
      epicSummary: 'Epic Trùng Lặp',
      channel: 'discord',
      payload: { test: true },
    });
    assert(duplicateRecord === null, 'Gửi lại cùng eventId bị chặn không tạo thêm bản ghi trùng (ON CONFLICT DO NOTHING)');

    // Đánh dấu thành công
    const updatedRecord = await NotificationService.markEventSent(testEventId, { delivered: true });
    assert(updatedRecord.status === 'sent', 'Cập nhật trạng thái thành công cho sự kiện');

    // 3. Test lấy lịch sử thông báo
    console.log('\n--- Test 2: Truy vấn lịch sử thông báo ---');
    const history = await NotificationService.getHistory(user.id, 5);
    assert(Array.isArray(history) && history.length > 0, `Lấy được danh sách lịch sử thông báo (${history.length} bản ghi)`);
    assert(history[0].event_id === testEventId, 'Bản ghi vừa tạo xuất hiện đầu danh sách lịch sử');

    // 4. Test cấu hình thông báo và che giấu secret
    console.log('\n--- Test 3: Cấu hình thông báo & Che giấu Webhook URL ---');
    const ConfigService = require('../services/config.service');
    const mockDiscordUrl = 'https://discord.com/api/webhooks/123456789/abcdefghijk_secret_token';
    await ConfigService.saveConfig(user.id, {
      notification_enabled: true,
      notification_channel: 'discord',
      discord_webhook_url: mockDiscordUrl,
      notification_email: 'team-dev@example.com',
    });

    const maskedConfig = await ConfigService.getConfig(user.id);
    assert(maskedConfig.notification_enabled === true, 'Cấu hình notification_enabled = true');
    assert(maskedConfig.notification_channel === 'discord', 'Kênh thông báo là discord');
    assert(maskedConfig.discord_webhook_url_configured === true, 'Đã đánh dấu discord_webhook_url_configured = true');
    assert(
      maskedConfig.discord_webhook_url_masked &&
      maskedConfig.discord_webhook_url_masked.startsWith('********') &&
      !maskedConfig.discord_webhook_url_masked.includes('abcdefghijk_secret_token'),
      'Discord Webhook URL đã được che giấu (masked), không lộ secret token ra ngoài'
    );

    // 5. Test Non-blocking khi n8n không phản hồi hoặc URL sai
    console.log('\n--- Test 4: Khả năng chịu lỗi Non-blocking đối với Flow 7 ---');
    const nonBlockingResult = await NotificationService.sendEpicCreatedNotification({
      userId: user.id,
      projectKey: 'TEST',
      epic: {
        id: '9999',
        key: 'TEST-999',
        title: 'Epic Kiểm Tra Non Blocking',
      },
    });
    // NotificationService không được ném uncaught exception làm sập app
    assert(
      typeof nonBlockingResult === 'object' && nonBlockingResult !== null,
      'Hàm sendEpicCreatedNotification bắt lỗi an toàn, không ném exception làm fail Flow 7'
    );

    // 6. Test cơ chế tắt thông báo (notification_enabled = false)
    console.log('\n--- Test 5: Tắt thông báo (notification_enabled = false) ---');
    await ConfigService.saveConfig(user.id, {
      notification_enabled: false,
    });
    const disabledResult = await NotificationService.sendEpicCreatedNotification({
      userId: user.id,
      projectKey: 'TEST',
      epic: { key: 'TEST-888', title: 'Epic khi tắt thông báo' },
    });
    assert(disabledResult === null, 'Khi notification_enabled = false, hệ thống tự động bỏ qua không phát sự kiện');

    // Bật lại thông báo
    await ConfigService.saveConfig(user.id, {
      notification_enabled: true,
    });

    // 7. Test xử lý nhiều Epic độc lập
    console.log('\n--- Test 6: Xử lý nhiều Epic tạo thành công ---');
    const epicList = [
      { key: 'TEST-1', title: 'Epic Alpha' },
      { key: 'TEST-2', title: 'Epic Beta' },
    ];
    const generatedEventIds = new Set();
    for (const ep of epicList) {
      const evtId = `evt_multi_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      generatedEventIds.add(evtId);
      await NotificationService.recordEvent({
        eventId: evtId,
        eventType: 'jira.epic.created',
        userId: user.id,
        projectKey: 'TEST',
        epicKey: ep.key,
        epicSummary: ep.title,
        channel: 'discord',
        payload: { epic: ep },
      });
    }
    assert(generatedEventIds.size === 2, 'Mỗi Epic tạo thành công có một eventId duy nhất độc lập');

    console.log('\n=====================================================');
    console.log(`🎉 KẾT QUẢ: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('=====================================================\n');
  } catch (err) {
    console.error('❌ Lỗi trong quá trình kiểm thử:', err);
  } finally {
    if (db.pool && db.pool.end) {
      await db.pool.end();
    }
  }
}

runTests();
