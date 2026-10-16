require('dotenv').config();
const assert = require('assert');
const ProjectModel = require('../models/project.model');
const JiraIssueModel = require('../models/jiraIssue.model');
const JiraService = require('../services/jira.service');
const DashboardService = require('../services/dashboard.service');
const db = require('../config/db');

async function runWorkspaceIsolationTest() {
  console.log('=====================================================');
  console.log('🚀 KIỂM THỬ PHÂN TÁCH DỮ LIỆU LUỒNG 9 THEO WORKSPACE (MULTI-WORKSPACE)');
  console.log('=====================================================\n');

  const userId = 'c9e09b9d-6a9f-4d2a-b998-ed3acfc46509';
  const otherUserId = '00000000-0000-0000-0000-000000000001'; // Mock user không có quyền

  let workspaceA = null;
  let workspaceB = null;

  try {
    // ── Kịch bản 1: Tạo Workspace A và Workspace B cùng dùng Jira Key SCRUM ──
    console.log('--- Kịch bản 1: Tạo 2 Workspace nội bộ cùng dùng Jira Project Key "SCRUM" ---');
    workspaceA = await ProjectModel.create({
      userId,
      name: 'Workspace Alpha QA',
      description: 'Hệ thống Quản lý Khách sạn',
      projectKey: 'SCRUM',
    });
    console.log(`✅ [PASS] Đã tạo Workspace A: ID=${workspaceA.id}, JiraKey=${workspaceA.project_key}`);

    workspaceB = await ProjectModel.create({
      userId,
      name: 'Workspace Beta QA',
      description: 'Hệ thống Đặt vé Xem phim',
      projectKey: 'SCRUM',
    });
    console.log(`✅ [PASS] Đã tạo Workspace B: ID=${workspaceB.id}, JiraKey=${workspaceB.project_key}`);

    // ── Kịch bản 2: Ánh xạ 3 Issues cho A và 2 Issues cho B (cùng prefix SCRUM) ──
    console.log('\n--- Kịch bản 2: Tạo dữ liệu Issue: 3 cho A, 2 cho B, 1 unmapped ---');
    const now = new Date();

    // 3 issues của Workspace A
    await JiraIssueModel.upsert({
      issueKey: 'SCRUM-9001',
      issueId: '80001',
      projectKey: 'SCRUM',
      summary: 'Epic Đặt phòng trực tuyến',
      issueType: 'Epic',
      status: 'To Do',
      userId,
      projectId: workspaceA.id,
      lastSyncedAt: now,
    });
    await JiraIssueModel.upsert({
      issueKey: 'SCRUM-9002',
      issueId: '80002',
      projectKey: 'SCRUM',
      summary: 'Story Chọn ngày nhận phòng',
      issueType: 'Story',
      status: 'In Progress',
      userId,
      projectId: workspaceA.id,
      lastSyncedAt: now,
    });
    await JiraIssueModel.upsert({
      issueKey: 'SCRUM-9003',
      issueId: '80003',
      projectKey: 'SCRUM',
      summary: 'Task Thanh toán cọc',
      issueType: 'Task',
      status: 'Done',
      userId,
      projectId: workspaceA.id,
      lastSyncedAt: now,
    });

    // 2 issues của Workspace B
    await JiraIssueModel.upsert({
      issueKey: 'SCRUM-9004',
      issueId: '80011',
      projectKey: 'SCRUM',
      summary: 'Epic Chọn suất chiếu phim',
      issueType: 'Epic',
      status: 'To Do',
      userId,
      projectId: workspaceB.id,
      lastSyncedAt: now,
    });
    await JiraIssueModel.upsert({
      issueKey: 'SCRUM-9005',
      issueId: '80012',
      projectKey: 'SCRUM',
      summary: 'Story Chọn ghế ngồi rạp',
      issueType: 'Story',
      status: 'Done',
      userId,
      projectId: workspaceB.id,
      lastSyncedAt: now,
    });

    // 1 issue chưa ánh xạ (project_id = null) nhưng cùng key SCRUM
    await JiraIssueModel.upsert({
      issueKey: 'SCRUM-9009',
      issueId: '80099',
      projectKey: 'SCRUM',
      summary: 'Issue mồ côi không thuộc workspace nào',
      issueType: 'Task',
      status: 'Done',
      userId,
      projectId: null,
      lastSyncedAt: now,
    });
    console.log('✅ [PASS] Đã tạo 3 issues cho A, 2 issues cho B, và 1 issue unmapped');

    // ── Kịch bản 3: Truy vấn theo Workspace A ──────────────────────────────
    console.log('\n--- Kịch bản 3: Kiểm tra truy vấn khi mở Workspace A ---');
    const issuesA = await JiraService.getSyncedIssues({
      projectId: workspaceA.id,
      projectKey: 'SCRUM',
      userId,
    });
    assert.strictEqual(issuesA.length, 3, 'Workspace A phải trả về CHÍNH XÁC 3 issues');
    const keysA = issuesA.map((i) => i.issue_key);
    assert(keysA.includes('SCRUM-9001'), 'A có issue A1');
    assert(keysA.includes('SCRUM-9002'), 'A có issue A2');
    assert(keysA.includes('SCRUM-9003'), 'A có issue A3');
    assert(!keysA.includes('SCRUM-9004'), 'A tuyệt đối không chứa B1');
    assert(!keysA.includes('SCRUM-9005'), 'A tuyệt đối không chứa B2');
    assert(!keysA.includes('SCRUM-9009'), 'A tuyệt đối không chứa issue unmapped');
    console.log('✅ [PASS] Workspace A chỉ hiển thị 3 issues của riêng nó (không lẫn của B hay unmapped)');

    // ── Kịch bản 4: Truy vấn theo Workspace B ──────────────────────────────
    console.log('\n--- Kịch bản 4: Kiểm tra truy vấn khi mở Workspace B ---');
    const issuesB = await JiraService.getSyncedIssues({
      projectId: workspaceB.id,
      projectKey: 'SCRUM',
      userId,
    });
    assert.strictEqual(issuesB.length, 2, 'Workspace B phải trả về CHÍNH XÁC 2 issues');
    const keysB = issuesB.map((i) => i.issue_key);
    assert(keysB.includes('SCRUM-9004'), 'B có issue B1');
    assert(keysB.includes('SCRUM-9005'), 'B có issue B2');
    assert(!keysB.includes('SCRUM-9001'), 'B tuyệt đối không chứa A1');
    assert(!keysB.includes('SCRUM-9009'), 'B tuyệt đối không chứa issue unmapped');
    console.log('✅ [PASS] Workspace B chỉ hiển thị 2 issues của riêng nó (không lẫn của A)');

    // ── Kịch bản 5: Kiểm tra tính toán 4 KPI thống kê độc lập ──────────────
    console.log('\n--- Kịch bản 5: Kiểm tra tính toán 4 KPI của Luồng 9 ---');
    // KPI A
    const totalA = issuesA.length;
    const doneA = issuesA.filter((i) => i.status.toLowerCase() === 'done').length;
    const inProgressA = issuesA.filter((i) => i.status.toLowerCase().includes('progress')).length;
    const todoA = totalA - doneA - inProgressA;
    assert.strictEqual(totalA, 3, 'KPI Tổng A = 3');
    assert.strictEqual(todoA, 1, 'KPI To Do A = 1');
    assert.strictEqual(inProgressA, 1, 'KPI In Progress A = 1');
    assert.strictEqual(doneA, 1, 'KPI Done A = 1');
    console.log(`✅ [PASS] KPI Workspace A: Tổng=${totalA}, ToDo=${todoA}, InProgress=${inProgressA}, Done=${doneA}`);

    // KPI B
    const totalB = issuesB.length;
    const doneB = issuesB.filter((i) => i.status.toLowerCase() === 'done').length;
    const inProgressB = issuesB.filter((i) => i.status.toLowerCase().includes('progress')).length;
    const todoB = totalB - doneB - inProgressB;
    assert.strictEqual(totalB, 2, 'KPI Tổng B = 2');
    assert.strictEqual(todoB, 1, 'KPI To Do B = 1');
    assert.strictEqual(inProgressB, 0, 'KPI In Progress B = 0');
    assert.strictEqual(doneB, 1, 'KPI Done B = 1');
    console.log(`✅ [PASS] KPI Workspace B: Tổng=${totalB}, ToDo=${todoB}, InProgress=${inProgressB}, Done=${doneB}`);

    // ── Kịch bản 6: Webhook cập nhật issue của A không ảnh hưởng issue của B ──
    console.log('\n--- Kịch bản 6: Webhook cập nhật trạng thái issue của A ---');
    await JiraService.handleJiraWebhook({
      webhookEvent: 'jira:issue_updated',
      issueKey: 'SCRUM-9002',
      status: 'Done',
      projectKey: 'SCRUM',
      issue: {
        key: 'SCRUM-9002',
        fields: {
          summary: 'Story Chọn ngày nhận phòng (Đã cập nhật)',
          status: { name: 'Done' },
          project: { key: 'SCRUM' },
        },
      },
    });

    const refreshedA = await JiraService.getSyncedIssues({ projectId: workspaceA.id, userId });
    const refreshedB = await JiraService.getSyncedIssues({ projectId: workspaceB.id, userId });
    const updatedA2 = refreshedA.find((i) => i.issue_key === 'SCRUM-9002');
    assert.strictEqual(updatedA2.status, 'Done', 'Issue A2 cập nhật thành công sang Done');
    assert.strictEqual(refreshedA.length, 3, 'Tổng issue A vẫn chính xác là 3');
    assert.strictEqual(refreshedB.length, 2, 'Tổng issue B vẫn giữ nguyên là 2');
    assert.strictEqual(updatedA2.project_id, workspaceA.id, 'Issue A2 giữ nguyên liên kết với Workspace A');
    console.log('✅ [PASS] Webhook cập nhật trạng thái chính xác bản ghi, bảo toàn project_id, không ảnh hưởng Workspace B');

    // ── Kịch bản 7: Kiểm tra Dashboard Service (Flow 10) cách ly theo Project ──
    console.log('\n--- Kịch bản 7: Kiểm tra thống kê Dashboard (Flow 10) khi truyền projectId ---');
    const dashSummaryA = await DashboardService.getSummary({ userId, projectId: workspaceA.id });
    assert.strictEqual(dashSummaryA.totalIssues, 3, 'Dashboard Project A chỉ đếm đúng 3 issues của A');
    const dashSummaryB = await DashboardService.getSummary({ userId, projectId: workspaceB.id });
    assert.strictEqual(dashSummaryB.totalIssues, 2, 'Dashboard Project B chỉ đếm đúng 2 issues của B');
    console.log('✅ [PASS] Flow 10 Dashboard thống kê chính xác tuyệt đối theo từng Workspace');

    // ── Kịch bản 8: Kiểm tra Export Service (Flow 12) cách ly theo Project ──
    console.log('\n--- Kịch bản 8: Kiểm tra Export (Flow 12) khi truyền projectId ---');
    const exportIssuesA = await JiraIssueModel.findByProjectForExport({
      projectId: workspaceA.id,
      projectKey: 'SCRUM',
      userId,
    });
    assert.strictEqual(exportIssuesA.length, 3, 'Export Project A chỉ chứa 3 issues của A');
    const exportIssuesB = await JiraIssueModel.findByProjectForExport({
      projectId: workspaceB.id,
      projectKey: 'SCRUM',
      userId,
    });
    assert.strictEqual(exportIssuesB.length, 2, 'Export Project B chỉ chứa 2 issues của B');
    console.log('✅ [PASS] Flow 12 Export tài liệu chỉ lấy đúng issues của từng Workspace');

    // ── Kịch bản 9: Dọn dẹp dữ liệu test an toàn ───────────────────────────
    console.log('\n--- Kịch bản 9: Dọn dẹp bản ghi kiểm thử ---');
    await db.query("DELETE FROM jira_issues WHERE issue_key IN ('SCRUM-9001', 'SCRUM-9002', 'SCRUM-9003', 'SCRUM-9004', 'SCRUM-9005', 'SCRUM-9009')");
    await ProjectModel.delete(workspaceA.id, userId);
    await ProjectModel.delete(workspaceB.id, userId);
    console.log('✅ [PASS] Đã dọn dẹp các bản ghi thử nghiệm an toàn');

    console.log('\n=====================================================');
    console.log('🎯 TẤT CẢ CÁC BÀI TEST PHÂN TÁCH LUỒNG 9 THEO WORKSPACE ĐÃ ĐẠT 100%!');
    console.log('=====================================================');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    if (workspaceA) await ProjectModel.delete(workspaceA.id, userId).catch(() => {});
    if (workspaceB) await ProjectModel.delete(workspaceB.id, userId).catch(() => {});
    await db.query("DELETE FROM jira_issues WHERE issue_key IN ('SCRUM-9001', 'SCRUM-9002', 'SCRUM-9003', 'SCRUM-9004', 'SCRUM-9005', 'SCRUM-9009')").catch(() => {});
    process.exit(1);
  }
}

runWorkspaceIsolationTest().then(() => process.exit(0));
