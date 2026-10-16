const db = require('../config/db');
const JiraService = require('../services/jira.service');
const JiraIssueModel = require('../models/jiraIssue.model');
const crypto = require('crypto');

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ LUỒNG 9: JIRA WEBHOOK SYNC');
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
    const testIssueKey = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const testProjectKey = 'TEST';

    // --- Test 1: Tiếp nhận và xử lý sự kiện cập nhật Issue từ Jira Cloud ---
    console.log('--- Test 1: Tiếp nhận sự kiện jira:issue_updated ---');
    const updatePayload1 = {
      webhookEvent: 'jira:issue_updated',
      issue: {
        id: '99001',
        key: testIssueKey,
        fields: {
          summary: 'Kiểm thử đồng bộ trạng thái Webhook',
          status: { name: 'To Do', statusCategory: { name: 'To Do' } },
          issuetype: { name: 'Task' },
          project: { key: testProjectKey },
          assignee: { displayName: 'Kỹ sư Demo' },
        },
      },
    };

    const res1 = await JiraService.handleJiraWebhook(updatePayload1);
    assert(res1.action === 'synced', 'Phản hồi action = "synced" khi nhận sự kiện hợp lệ');
    assert(res1.issueKey === testIssueKey, `Trả về đúng issueKey = ${testIssueKey}`);
    assert(res1.status === 'To Do', 'Trạng thái ban đầu ghi nhận là "To Do"');

    // Kiểm tra trực tiếp trong PostgreSQL
    const dbRecord1 = await JiraIssueModel.findByKey(testIssueKey);
    assert(dbRecord1 !== null, 'Bản ghi issue xuất hiện trong bảng jira_issues');
    assert(dbRecord1.status === 'To Do', 'Cột status trong CSDL lưu đúng "To Do"');
    assert(dbRecord1.assignee === 'Kỹ sư Demo', 'Cột assignee lưu đúng "Kỹ sư Demo"');

    // --- Test 2: Chuyển trạng thái sang "In Progress" và "Done" ---
    console.log('\n--- Test 2: Chuyển trạng thái liên tục (To Do -> In Progress -> Done) ---');
    const updatePayload2 = {
      webhookEvent: 'jira:issue_updated',
      issue: {
        id: '99001',
        key: testIssueKey,
        fields: {
          summary: 'Kiểm thử đồng bộ trạng thái Webhook',
          status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
          issuetype: { name: 'Task' },
          project: { key: testProjectKey },
          assignee: { displayName: 'Kỹ sư Demo' },
        },
      },
    };

    await JiraService.handleJiraWebhook(updatePayload2);
    const dbRecord2 = await JiraIssueModel.findByKey(testIssueKey);
    assert(dbRecord2.status === 'In Progress', 'Trạng thái CSDL chuyển sang "In Progress"');

    const updatePayload3 = {
      webhookEvent: 'jira:issue_updated',
      issue: {
        id: '99001',
        key: testIssueKey,
        fields: {
          summary: 'Kiểm thử đồng bộ trạng thái Webhook',
          status: { name: 'Done', statusCategory: { name: 'Done' } },
          issuetype: { name: 'Task' },
          project: { key: testProjectKey },
          assignee: { displayName: 'Kỹ sư Demo' },
        },
      },
    };

    await JiraService.handleJiraWebhook(updatePayload3);
    const dbRecord3 = await JiraIssueModel.findByKey(testIssueKey);
    assert(dbRecord3.status === 'Done', 'Trạng thái CSDL chuyển sang "Done"');

    // --- Test 3: Khả năng chống trùng lặp (Idempotency) ---
    console.log('\n--- Test 3: Tính Idempotent (Gửi lặp lại cùng sự kiện không nhân bản bản ghi) ---');
    const countBeforeRes = await db.query(
      'SELECT COUNT(*) as total FROM jira_issues WHERE issue_key = $1',
      [testIssueKey]
    );
    const countBefore = parseInt(countBeforeRes.rows[0].total, 10);

    // Gửi lại cùng payload 3 lần
    await JiraService.handleJiraWebhook(updatePayload3);
    await JiraService.handleJiraWebhook(updatePayload3);
    await JiraService.handleJiraWebhook(updatePayload3);

    const countAfterRes = await db.query(
      'SELECT COUNT(*) as total FROM jira_issues WHERE issue_key = $1',
      [testIssueKey]
    );
    const countAfter = parseInt(countAfterRes.rows[0].total, 10);
    assert(countBefore === 1 && countAfter === 1, 'Số lượng bản ghi giữ nguyên chính xác là 1 (không bị duplicate)');

    // --- Test 4: Sự kiện xóa issue trên Jira (jira:issue_deleted) ---
    console.log('\n--- Test 4: Xử lý sự kiện jira:issue_deleted ---');
    const deletePayload = {
      webhookEvent: 'jira:issue_deleted',
      issue: {
        key: testIssueKey,
      },
    };

    const resDel = await JiraService.handleJiraWebhook(deletePayload);
    assert(resDel.action === 'deleted', 'Phản hồi action = "deleted" khi nhận sự kiện xóa');

    const dbRecordDeleted = await JiraIssueModel.findByKey(testIssueKey);
    assert(dbRecordDeleted === null, 'Bản ghi issue đã được xóa sạch khỏi cơ sở dữ liệu PostgreSQL');

    // --- Test 5: Kiểm tra tính an toàn với Payload không hợp lệ ---
    console.log('\n--- Test 5: Validation payload không hợp lệ ---');
    let threwNull = false;
    try {
      await JiraService.handleJiraWebhook(null);
    } catch (e) {
      threwNull = true;
    }
    assert(threwNull, 'Từ chối payload null với HTTP 400 Bad Request');

    const resNoKey = await JiraService.handleJiraWebhook({ webhookEvent: 'jira:issue_updated' });
    assert(resNoKey.action === 'ignored', 'Bỏ qua an toàn payload thiếu issue key (action = "ignored")');

    const resBadKey = await JiraService.handleJiraWebhook({
      webhookEvent: 'jira:issue_updated',
      issue: { key: '../../malicious-path' },
    });
    assert(resBadKey.action === 'ignored', 'Chặn an toàn mã issue key không đúng định dạng Jira (Path traversal/injection)');

    // --- Test 6: Cơ chế xác minh chữ ký Atlassian Jira HMAC-SHA256 (X-Hub-Signature) ---
    console.log('\n--- Test 6: Kiểm tra bảo mật HMAC Webhook Secret ---');
    const testSecret = 'atlassian_webhook_super_secret_test_key_2026';
    const originalEnvSecret = process.env.JIRA_WEBHOOK_SECRET;

    try {
      // Trường hợp A: Backend không cấu hình Secret (mặc định mở cho Jira sandbox)
      delete process.env.JIRA_WEBHOOK_SECRET;
      const checkNoSecret = JiraService.verifyWebhookSignature({
        headers: {},
        body: { test: true },
      });
      assert(checkNoSecret.valid === true, 'Khi backend không cấu hình secret, cho phép nhận webhook bình thường');

      // Trường hợp B: Backend có cấu hình Secret
      process.env.JIRA_WEBHOOK_SECRET = testSecret;

      // Request thiếu header X-Hub-Signature
      const checkMissingHeader = JiraService.verifyWebhookSignature({
        headers: {},
        body: { test: true },
      });
      assert(checkMissingHeader.valid === false, 'Từ chối khi thiếu header chữ ký X-Hub-Signature');

      // Request có chữ ký sai
      const checkWrongSig = JiraService.verifyWebhookSignature({
        headers: { 'x-hub-signature': 'sha256=0123456789abcdef0123456789abcdef' },
        body: { test: true },
      });
      assert(checkWrongSig.valid === false, 'Từ chối khi chữ ký HMAC không khớp bí mật');

      // Request có chữ ký chuẩn HMAC-SHA256
      const payloadObj = { event: 'jira:issue_updated', key: 'PROJ-1' };
      const rawBody = JSON.stringify(payloadObj);
      const validHmac = crypto.createHmac('sha256', testSecret).update(rawBody).digest('hex');

      const checkValidSig = JiraService.verifyWebhookSignature({
        headers: { 'x-hub-signature': `sha256=${validHmac}` },
        rawBody: Buffer.from(rawBody),
        body: payloadObj,
      });
      assert(checkValidSig.valid === true, 'Xác nhận hợp lệ khi chữ ký HMAC-SHA256 khớp 100% với bí mật Atlassian');
    } finally {
      if (originalEnvSecret) {
        process.env.JIRA_WEBHOOK_SECRET = originalEnvSecret;
      } else {
        delete process.env.JIRA_WEBHOOK_SECRET;
      }
    }

    // --- Test 7: Giả lập Webhook (Mock Simulator Endpoint) ---
    console.log('\n--- Test 7: Kiểm thử bộ công cụ Giả lập Webhook (Simulator) ---');
    const simKey = `SIM-${Math.floor(1000 + Math.random() * 9000)}`;
    const simResult = await JiraService.simulateWebhookSync({
      issueKey: simKey,
      status: 'In Progress',
      assignee: 'Người Thuyết Trình',
      summary: 'Task Giả Lập Live Demo',
      issueType: 'Story',
    });

    assert(simResult.action === 'synced', 'Giả lập thành công trả về action = "synced"');
    const simDbRecord = await JiraIssueModel.findByKey(simKey);
    assert(simDbRecord !== null && simDbRecord.status === 'In Progress', 'Task giả lập được lưu vào DB với status "In Progress"');

    // Dọn dẹp dữ liệu test
    await JiraIssueModel.deleteByKey(simKey);

    // --- Test 8: Truy vấn danh sách issue đã đồng bộ ---
    console.log('\n--- Test 8: Truy vấn danh sách Synced Issues ---');
    const syncedList = await JiraService.getSyncedIssues();
    assert(Array.isArray(syncedList), 'Trả về mảng danh sách các issue đã đồng bộ');

    console.log('\n=====================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ LUỒNG 9: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('=====================================================');

    if (passedTests === totalTests) {
      console.log('🎉 TẤT CẢ CÁC BÀI TEST CỦA LUỒNG 9 ĐÃ ĐẠT 100%!\n');
    } else {
      console.error('❌ MỘT SỐ BÀI TEST CHƯA ĐẠT!\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Lỗi không xác định trong quá trình kiểm thử Luồng 9:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runTests();
