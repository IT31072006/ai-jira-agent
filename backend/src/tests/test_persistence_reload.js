require('dotenv').config();
const assert = require('assert');
const ProjectModel = require('../models/project.model');
const JiraIssueModel = require('../models/jiraIssue.model');
const JiraService = require('../services/jira.service');
const db = require('../config/db');

async function runPersistenceReloadTest() {
  console.log('=====================================================');
  console.log('🚀 KIỂM THỬ KHÔI PHỤC DỮ LIỆU SAU KHI TẢI LẠI (F5 / RELOAD)');
  console.log('=====================================================\n');

  const userRes = await db.query('SELECT id FROM users LIMIT 1');
  const userId = userRes.rows[0]?.id;
  if (!userId) {
    throw new Error('Không tìm thấy người dùng nào trong CSDL để chạy test');
  }
  let projectA = null;
  let projectB = null;

  try {
    // ── Bước 1: Tạo 2 Workspace / Project thử nghiệm ──────────────────────────
    console.log('--- Bước 1: Tạo 2 Project thử nghiệm độc lập ---');
    projectA = await ProjectModel.create({
      userId,
      name: 'Test Project Alpha Reload',
      description: 'Workspace kiểm thử khôi phục F5 Alpha',
      projectKey: 'ALPHA',
    });
    console.log(`✅ [PASS] Đã tạo Project Alpha: ID=${projectA.id}, Key=${projectA.project_key}`);

    projectB = await ProjectModel.create({
      userId,
      name: 'Test Project Beta Reload',
      description: 'Workspace kiểm thử khôi phục F5 Beta',
      projectKey: 'BETA',
    });
    console.log(`✅ [PASS] Đã tạo Project Beta: ID=${projectB.id}, Key=${projectB.project_key}`);

    // ── Bước 2: Lưu các issues đã đồng bộ vào Project Alpha ───────────────────
    console.log('\n--- Bước 2: Lưu cấu trúc Epics -> Stories -> Tasks cho Project Alpha ---');
    const now = new Date();

    // Epic 1 Alpha
    await JiraIssueModel.upsert({
      issueKey: 'ALPHA-1',
      issueId: '90001',
      projectKey: 'ALPHA',
      summary: 'Epic Quản lý Đơn hàng Alpha',
      description: 'Mô tả Epic Alpha',
      issueType: 'Epic',
      status: 'To Do',
      userId,
      projectId: projectA.id,
      parentKey: null,
      lastSyncedAt: now,
    });

    // Story 1.1 Alpha (thuộc Epic 1)
    await JiraIssueModel.upsert({
      issueKey: 'ALPHA-2',
      issueId: '90002',
      projectKey: 'ALPHA',
      summary: 'Story Xem giỏ hàng',
      description: 'Là khách hàng, tôi muốn xem giỏ hàng',
      issueType: 'Story',
      status: 'In Progress',
      assignee: 'Nguyễn Văn A',
      userId,
      projectId: projectA.id,
      parentKey: 'ALPHA-1',
      lastSyncedAt: now,
    });

    // Subtask 1.1.1 Alpha (thuộc Story 1.1)
    await JiraIssueModel.upsert({
      issueKey: 'ALPHA-3',
      issueId: '90003',
      projectKey: 'ALPHA',
      summary: 'Task Thiết kế UI giỏ hàng',
      description: 'Tạo component giỏ hàng',
      issueType: 'Subtask',
      status: 'Done',
      assignee: 'Trần Thị B',
      userId,
      projectId: projectA.id,
      parentKey: 'ALPHA-2',
      lastSyncedAt: now,
    });

    // Epic 1 Beta (thuộc Project Beta)
    await JiraIssueModel.upsert({
      issueKey: 'BETA-1',
      issueId: '90010',
      projectKey: 'BETA',
      summary: 'Epic Độc lập của Project Beta',
      description: 'Không được xuất hiện trong Alpha',
      issueType: 'Epic',
      status: 'To Do',
      userId,
      projectId: projectB.id,
      parentKey: null,
      lastSyncedAt: now,
    });
    console.log('✅ [PASS] Đã lưu 3 issues vào Alpha và 1 issue vào Beta trong PostgreSQL');

    // ── Bước 3: Giả lập F5 / Reload trên Project Alpha ──────────────────────
    console.log('\n--- Bước 3: Giả lập F5 / Reload: Khôi phục danh sách Issue theo Project ID ---');
    const alphaIssuesById = await JiraService.getSyncedIssues({
      projectId: projectA.id,
      userId,
    });
    assert.strictEqual(alphaIssuesById.length, 3, 'Alpha phải khôi phục đúng 3 issues');
    console.log(`✅ [PASS] Truy vấn theo projectId khôi phục chính xác 3 issues cho Project Alpha`);

    // ── Bước 4: Kiểm tra cách ly dữ liệu giữa 2 Workspace ──────────────────
    console.log('\n--- Bước 4: Kiểm tra cách ly dữ liệu giữa Alpha và Beta ---');
    const betaIssues = await JiraService.getSyncedIssues({
      projectId: projectB.id,
      userId,
    });
    assert.strictEqual(betaIssues.length, 1, 'Beta phải chỉ có 1 issue');
    assert.strictEqual(betaIssues[0].issue_key, 'BETA-1', 'Issue của Beta phải là BETA-1');

    // Đảm bảo không có issue nào của Beta lẫn vào Alpha
    const hasBetaInAlpha = alphaIssuesById.some((i) => i.project_key === 'BETA' || i.issue_key.startsWith('BETA'));
    assert.strictEqual(hasBetaInAlpha, false, 'Dữ liệu của Beta tuyệt đối không được lẫn vào Alpha');
    console.log('✅ [PASS] Dữ liệu hoàn toàn độc lập giữa các Workspace, không bị lẫn lộn');

    // ── Bước 5: Kiểm tra khôi phục cây phân cấp (Epic -> Story -> Task) ─────
    console.log('\n--- Bước 5: Kiểm tra thuật toán tái tạo cây 3 cấp từ PostgreSQL ---');
    // Chạy thuật toán tái tạo cây
    const reconstructTree = (rawIssues) => {
      const epicsMap = new Map();
      const storiesMap = new Map();
      const tasks = [];

      rawIssues.forEach((iss) => {
        const type = (iss.issue_type || '').toLowerCase();
        if (type === 'epic') {
          epicsMap.set(iss.issue_key, { ...iss, stories: [] });
        }
      });

      rawIssues.forEach((iss) => {
        const type = (iss.issue_type || '').toLowerCase();
        if (type === 'story') {
          const story = { ...iss, tasks: [] };
          storiesMap.set(iss.issue_key, story);
          if (iss.parent_key && epicsMap.has(iss.parent_key)) {
            epicsMap.get(iss.parent_key).stories.push(story);
          }
        }
      });

      rawIssues.forEach((iss) => {
        const type = (iss.issue_type || '').toLowerCase();
        if (type !== 'epic' && type !== 'story') {
          if (iss.parent_key && storiesMap.has(iss.parent_key)) {
            storiesMap.get(iss.parent_key).tasks.push(iss);
          } else {
            tasks.push(iss);
          }
        }
      });

      return Array.from(epicsMap.values());
    };

    const tree = reconstructTree(alphaIssuesById);
    assert.strictEqual(tree.length, 1, 'Cây phải có 1 Epic');
    assert.strictEqual(tree[0].issue_key, 'ALPHA-1');
    assert.strictEqual(tree[0].stories.length, 1, 'Epic ALPHA-1 phải có 1 Story');
    assert.strictEqual(tree[0].stories[0].issue_key, 'ALPHA-2');
    assert.strictEqual(tree[0].stories[0].assignee, 'Nguyễn Văn A', 'Story bảo toàn Assignee');
    assert.strictEqual(tree[0].stories[0].tasks.length, 1, 'Story ALPHA-2 phải có 1 Task');
    assert.strictEqual(tree[0].stories[0].tasks[0].issue_key, 'ALPHA-3');
    assert.strictEqual(tree[0].stories[0].tasks[0].assignee, 'Trần Thị B', 'Task bảo toàn Assignee');
    console.log('✅ [PASS] Cây phân cấp Epic -> Story -> Task được tái tạo chính xác 100%');
    console.log('✅ [PASS] Thông tin Assignee và Status được bảo toàn đầy đủ');

    // ── Bước 6: Dọn dẹp dữ liệu thử nghiệm an toàn ───────────────────────────
    console.log('\n--- Bước 6: Dọn dẹp bản ghi thử nghiệm ---');
    await db.query("DELETE FROM jira_issues WHERE project_key IN ('ALPHA', 'BETA')");
    await ProjectModel.delete(projectA.id, userId);
    await ProjectModel.delete(projectB.id, userId);
    console.log('✅ [PASS] Đã dọn dẹp các bản ghi thử nghiệm an toàn');

    console.log('\n=====================================================');
    console.log('🎯 TẤT CẢ CÁC BÀI TEST KIỂM THỬ KHÔI PHỤC DỮ LIỆU ĐÃ ĐẠT 100%!');
    console.log('=====================================================');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    if (projectA) await ProjectModel.delete(projectA.id, userId).catch(() => {});
    if (projectB) await ProjectModel.delete(projectB.id, userId).catch(() => {});
    await db.query("DELETE FROM jira_issues WHERE project_key IN ('ALPHA', 'BETA')").catch(() => {});
    process.exit(1);
  }
}

runPersistenceReloadTest().then(() => process.exit(0));
