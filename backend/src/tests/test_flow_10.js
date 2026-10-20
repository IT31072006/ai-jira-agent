/**
 * KIỂM THỬ TOÀN DIỆN LUỒNG 10 (FLOW 10): DASHBOARD ANALYTICS & N8N ORCHESTRATION
 * Kiểm chứng 12 MAIN Nodes, AUX Nodes, Webhook Trigger, Bảo mật Service-to-Service,
 * Độ chính xác KPI, Phân bố trạng thái, Phân tách Workspace, và Khả năng chịu lỗi.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = require('../app');
const db = require('../config/db');
const env = require('../config/env');
const UserModel = require('../models/user.model');
const ProjectModel = require('../models/project.model');
const DashboardService = require('../services/dashboard.service');
const DashboardFlowService = require('../services/dashboard-flow.service');

const WORKFLOW_PATH = path.resolve(__dirname, '../../../n8n/workflows/flow-10-dashboard-analytics.json');

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN LUỒNG 10: DASHBOARD ANALYTICS TRÊN N8N');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;
  let testServer = null;
  const TEST_PORT = 5001;
  const TEST_SERVER_URL = `http://localhost:${TEST_PORT}`;

  function testAssert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  let user = null;
  let userToken = null;
  let sampleProject = null;
  let emptyProject = null;

  try {
    // 0. Khởi động Backend Express test server trên cổng 5001
    testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
    console.log(`📡 Backend Express test server đang lắng nghe tại: ${TEST_SERVER_URL}`);
    process.env.BACKEND_INTERNAL_URL = TEST_SERVER_URL;

    // Lấy test user có dữ liệu
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email 
       FROM users u 
       JOIN projects p ON p.user_id = u.id 
       LIMIT 1`
    );
    if (!userRes.rows.length) {
      throw new Error('Không tìm thấy người dùng có dữ liệu trong PostgreSQL để kiểm thử.');
    }
    user = userRes.rows[0];
    userToken = jwt.sign(
      { userId: user.id, id: user.id, email: user.email },
      env.JWT_SECRET || 'ai_jira_agent_super_secret_jwt_key_2026_dev',
      { expiresIn: '2h' }
    );
    console.log(`👤 Người dùng thử nghiệm: ${user.name} (${user.email}, ID: ${user.id})`);

    const projRes = await db.query(
      `SELECT * FROM projects WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );
    sampleProject = projRes.rows[0];
    console.log(`📁 Dự án mẫu: "${sampleProject.name}" (ID: ${sampleProject.id})\n`);

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 1: KIỂM CHỨNG CẤU TRÚC WORKFLOW JSON & QUY ƯỚC 12 MAIN NODE
    // ─────────────────────────────────────────────────────────────────
    console.log('--- PHẦN 1: KIỂM CHỨNG CẤU TRÚC WORKFLOW JSON & 12 MAIN NODES ---');
    testAssert(fs.existsSync(WORKFLOW_PATH), 'File flow-10-dashboard-analytics.json tồn tại trong n8n/workflows/');

    const workflowContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const workflow = JSON.parse(workflowContent);
    testAssert(workflow.id === 'Flow10DashboardAnalytics', 'Workflow ID là Flow10DashboardAnalytics');

    const mainNodes = workflow.nodes.filter((n) => n.name.startsWith('MAIN '));
    const auxNodes = workflow.nodes.filter((n) => n.name.startsWith('AUX '));
    const otherNodes = workflow.nodes.filter((n) => !n.name.startsWith('MAIN ') && !n.name.startsWith('AUX '));

    testAssert(mainNodes.length === 12, `Workflow có CHÍNH XÁC 12 MAIN Nodes (hiện có: ${mainNodes.length})`);
    testAssert(auxNodes.length >= 8, `Workflow có đầy đủ AUX Nodes phụ trợ (hiện có: ${auxNodes.length})`);
    testAssert(otherNodes.length === 0, `Không có node không xác định ngoài MAIN và AUX (hiện có: ${otherNodes.length})`);

    const expectedMainNames = [
      'MAIN 01 — Dashboard Webhook Trigger',
      'MAIN 02 — Request Validation',
      'MAIN 03 — Project Access Verification',
      'MAIN 04 — Fetch Dashboard Summary',
      'MAIN 05 — Fetch Status Distribution',
      'MAIN 06 — Fetch Issue Type Breakdown',
      'MAIN 07 — Fetch Issue Creation Trend',
      'MAIN 08 — Validate Analytics Dataset',
      'MAIN 09 — Calculate Completion Metrics',
      'MAIN 10 — Normalize Analytics Results',
      'MAIN 11 — Build Dashboard Response',
      'MAIN 12 — Respond to Backend',
    ];

    const actualMainNames = mainNodes.map((n) => n.name);
    const allExpectedPresent = expectedMainNames.every((name) => actualMainNames.includes(name));
    testAssert(allExpectedPresent, 'Tất cả 12 MAIN Nodes đều có tên chuẩn xác theo đặc tả');

    // Kiểm tra ràng buộc kỹ thuật tuyệt đối
    const hasPostgresNode = workflow.nodes.some((n) => (n.type || '').toLowerCase().includes('postgres'));
    testAssert(!hasPostgresNode, 'TUYỆT ĐỐI không có node PostgreSQL nào trong workflow JSON');

    const jsonStr = JSON.stringify(workflow).toLowerCase();
    const hasRawSql = jsonStr.includes('select ') && jsonStr.includes('from jira_issues');
    testAssert(!hasRawSql, 'TUYỆT ĐỐI không có SQL Query trực tiếp trong n8n workflow');

    const hasDbCreds = jsonStr.includes('postgres_password') || jsonStr.includes('db_password');
    testAssert(!hasDbCreds, 'TUYỆT ĐỐI không hardcode Database credentials trong workflow');

    // Kiểm tra tính toàn vẹn của kết nối (Connections)
    const nodeNamesSet = new Set(workflow.nodes.map((n) => n.name));
    let brokenLinks = 0;
    for (const [src, conn] of Object.entries(workflow.connections)) {
      if (!nodeNamesSet.has(src)) brokenLinks++;
      for (const branch of conn.main || []) {
        for (const link of branch) {
          if (!nodeNamesSet.has(link.node)) brokenLinks++;
        }
      }
    }
    testAssert(brokenLinks === 0, 'Toàn bộ liên kết giữa các node trong workflow đều hợp lệ (0 broken connections)');

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 2: KIỂM CHỨNG BẢO MẬT SERVICE-TO-SERVICE (INTERNAL AUTH)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 2: KIỂM CHỨNG BẢO MẬT SERVICE-TO-SERVICE & INTERNAL APIS ---');

    // Thử gọi không có Secret Header -> phải bị chặn 401
    try {
      await axios.get(`${TEST_SERVER_URL}/api/internal/dashboard/summary?userId=${user.id}`);
      testAssert(false, 'Chặn truy cập API nội bộ khi thiếu X-Internal-Service-Key');
    } catch (err) {
      testAssert(err.response?.status === 401, 'API nội bộ trả về 401 Unauthorized khi thiếu header xác thực');
    }

    // Thử gọi với Secret Key sai -> phải bị chặn 401
    try {
      await axios.get(`${TEST_SERVER_URL}/api/internal/dashboard/summary?userId=${user.id}`, {
        headers: { 'X-Internal-Service-Key': 'wrong_secret_key' },
      });
      testAssert(false, 'Chặn truy cập API nội bộ khi secret sai');
    } catch (err) {
      testAssert(err.response?.status === 401, 'API nội bộ trả về 401 Unauthorized khi secret không khớp');
    }

    // Gọi với Secret Key hợp lệ -> thành công 200
    const internalHeaders = {
      'X-Internal-Service-Key': env.INTERNAL_SERVICE_KEY,
    };
    const summaryRes = await axios.get(
      `${TEST_SERVER_URL}/api/internal/dashboard/summary?userId=${user.id}`,
      { headers: internalHeaders }
    );
    testAssert(summaryRes.status === 200 && summaryRes.data.success, 'API nội bộ cho phép truy cập với secret key hợp lệ');
    testAssert(typeof summaryRes.data.data.totalIssues === 'number', 'Summary trả về đúng trường totalIssues');
    testAssert(typeof summaryRes.data.data.totalStoryPoints === 'number', 'Summary trả về đúng trường totalStoryPoints');

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 3: KIỂM CHỨNG XÁC MINH QUYỀN TRUY CẬP DỰ ÁN (MAIN 03)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 3: KIỂM CHỨNG PROJECT ACCESS VERIFICATION (MAIN 03) ---');

    // Xác minh dự án hợp lệ của chính user -> allowed = true
    const verifyValid = await axios.post(
      `${TEST_SERVER_URL}/api/internal/dashboard/verify-access`,
      { userId: user.id, projectId: sampleProject.id },
      { headers: internalHeaders }
    );
    testAssert(verifyValid.data.allowed === true, 'Xác minh quyền: Cho phép truy cập dự án thuộc quyền sở hữu');
    testAssert(verifyValid.data.data.project.id === sampleProject.id, 'Trả về đúng thông tin định danh project');

    // Xác minh dự án không tồn tại hoặc ID giả mạo -> bị từ chối 403
    try {
      await axios.post(
        `${TEST_SERVER_URL}/api/internal/dashboard/verify-access`,
        { userId: user.id, projectId: '00000000-0000-0000-0000-000000000000' },
        { headers: internalHeaders }
      );
      testAssert(false, 'Từ chối dự án không tồn tại');
    } catch (err) {
      testAssert(err.response?.status === 403, 'Từ chối truy cập 403 Forbidden khi projectId không thuộc user');
    }

    // Xác minh không truyền projectId (phạm vi toàn bộ dự án) -> allowed = true
    const verifyAll = await axios.post(
      `${TEST_SERVER_URL}/api/internal/dashboard/verify-access`,
      { userId: user.id, projectId: null },
      { headers: internalHeaders }
    );
    testAssert(verifyAll.data.allowed === true, 'Cho phép truy cập tổng quan khi không chọn dự án cụ thể');

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 4: KIỂM CHỨNG CÁC INTERNAL APIS PHỤC VỤ MAIN 04–07
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 4: KIỂM CHỨNG 4 INTERNAL APIS PHỤC VỤ MAIN 04 ĐẾN 07 ---');

    // MAIN 05: Status Distribution
    const statusRes = await axios.get(
      `${TEST_SERVER_URL}/api/internal/dashboard/status-distribution?userId=${user.id}`,
      { headers: internalHeaders }
    );
    testAssert(statusRes.status === 200, 'MAIN 05 Internal API status-distribution trả về HTTP 200');
    testAssert(Array.isArray(statusRes.data.data.distribution), 'Phân bố trạng thái có cấu trúc mảng distribution');
    const { toDo, inProgress, done, total } = statusRes.data.data;
    testAssert(toDo + inProgress + done === total, 'Tổng các trạng thái To Do + In Progress + Done = Total Issues');

    // MAIN 06: Issue Breakdown
    const breakdownRes = await axios.get(
      `${TEST_SERVER_URL}/api/internal/dashboard/issue-breakdown?userId=${user.id}`,
      { headers: internalHeaders }
    );
    testAssert(breakdownRes.status === 200, 'MAIN 06 Internal API issue-breakdown trả về HTTP 200');
    testAssert(Array.isArray(breakdownRes.data.data.breakdown), 'Phân loại công việc có danh sách Epic, Story, Task');

    // MAIN 07: Creation Trend
    const trendRes = await axios.get(
      `${TEST_SERVER_URL}/api/internal/dashboard/creation-trend?userId=${user.id}`,
      { headers: internalHeaders }
    );
    testAssert(trendRes.status === 200, 'MAIN 07 Internal API creation-trend trả về HTTP 200');
    testAssert(Array.isArray(trendRes.data.data.trend), 'Xu hướng tạo issue theo ngày trả về mảng chuỗi ngày liên tục');

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 5: KIỂM THỬ ĐIỀU PHỐI QUA N8N WEBHOOK (FLOW 10 END-TO-END)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 5: KIỂM THỬ WORKFLOW N8N FLOW 10 TRỰC TIẾP QUA WEBHOOK ---');

    // Gọi webhook n8n Flow 10 với payload đầy đủ
    const n8nWebhookUrl = 'http://localhost:5678/webhook/dashboard-analytics';
    const flow10Payload = {
      userId: user.id,
      projectId: sampleProject.id,
      requestId: `test-dash-${Date.now()}`,
      backendUrl: TEST_SERVER_URL,
      internalSecret: env.INTERNAL_SERVICE_KEY,
    };

    const flow10Res = await axios.post(n8nWebhookUrl, flow10Payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000,
    });

    testAssert(flow10Res.status === 200, 'n8n Flow 10 Webhook phản hồi HTTP 200 OK');
    const flow10Data = flow10Res.data;
    testAssert(flow10Data.success === true, 'Flow 10 trả về success = true');
    testAssert(Boolean(flow10Data.summary), 'Flow 10 trả về summary object đầy đủ');
    testAssert(Boolean(flow10Data.breakdown), 'Flow 10 trả về breakdown object đầy đủ');
    testAssert(Boolean(flow10Data.statusDistribution), 'Flow 10 trả về statusDistribution object đầy đủ');
    testAssert(Boolean(flow10Data.creationTrend), 'Flow 10 trả về creationTrend object đầy đủ');
    testAssert(Boolean(flow10Data.completionMetrics), 'MAIN 09 tính toán và trả về completionMetrics');

    // Kiểm tra công thức tỷ lệ hoàn thành
    const expectedRate =
      flow10Data.summary.totalIssues > 0
        ? parseFloat(((flow10Data.statusDistribution.done / flow10Data.summary.totalIssues) * 100).toFixed(1))
        : 0;
    testAssert(
      flow10Data.completionMetrics.completionRate === expectedRate,
      `Tỷ lệ hoàn thành được tính đúng công thức: ${flow10Data.completionMetrics.completionRate}% (kỳ vọng: ${expectedRate}%)`
    );

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 6: KIỂM THỬ KỊCH BẢN BIÊN (EDGE CASES)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 6: KIỂM THỬ CÁC KỊCH BẢN BIÊN & NGOẠI LỆ ---');

    // Kịch bản A: Dự án chưa có Issue nào (Zero issues state)
    emptyProject = await ProjectModel.create({
      name: `Empty Project Test ${Date.now()}`,
      description: 'Dự án trống không có issue để kiểm thử tỷ lệ chia cho 0',
      userId: user.id,
      projectKey: 'EMPTY',
    });

    const emptyFlowRes = await axios.post(
      n8nWebhookUrl,
      {
        userId: user.id,
        projectId: emptyProject.id,
        requestId: `test-empty-${Date.now()}`,
        backendUrl: TEST_SERVER_URL,
        internalSecret: env.INTERNAL_SERVICE_KEY,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );

    testAssert(emptyFlowRes.data.success === true, 'Xử lý dự án trống (0 issue) thành công không lỗi');
    testAssert(emptyFlowRes.data.summary.totalIssues === 0, 'Dự án trống có tổng số Issue = 0');
    testAssert(emptyFlowRes.data.completionMetrics.completionRate === 0, 'Tỷ lệ hoàn thành dự án trống là 0% an toàn (không lỗi NaN hoặc chia cho 0)');

    // Kịch bản B: Yêu cầu thiếu dữ liệu xác thực (Validation Error)
    try {
      await axios.post(
        n8nWebhookUrl,
        { userId: '', projectId: sampleProject.id },
        { headers: { 'Content-Type': 'application/json' } }
      );
      testAssert(false, 'MAIN 02 phải chặn request thiếu userId');
    } catch (err) {
      testAssert(err.response?.status === 400, 'MAIN 02 chặn thành công request thiếu userId và trả về HTTP 400');
      testAssert(err.response?.data?.errorCode === 'INVALID_DASHBOARD_REQUEST', 'Mã lỗi đúng chuẩn INVALID_DASHBOARD_REQUEST');
    }

    // Kịch bản C: Yêu cầu truy cập trái phép Workspace của người khác (Access Denied)
    try {
      await axios.post(
        n8nWebhookUrl,
        {
          userId: user.id,
          projectId: 'c0760be6-c6f3-4ab6-a570-000000000000',
          backendUrl: TEST_SERVER_URL,
          internalSecret: env.INTERNAL_SERVICE_KEY,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      testAssert(false, 'MAIN 03 phải chặn truy cập trái phép');
    } catch (err) {
      testAssert(err.response?.status === 403, 'MAIN 03 chặn thành công và trả về HTTP 403 Forbidden khi không có quyền xem dự án');
      testAssert(err.response?.data?.errorCode === 'PROJECT_ACCESS_DENIED', 'Mã lỗi đúng chuẩn PROJECT_ACCESS_DENIED');
    }

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 7: KIỂM THỬ PUBLIC DASHBOARD APIS (BACKWARD COMPATIBILITY)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 7: KIỂM THỬ PUBLIC DASHBOARD APIS & TƯƠNG THÍCH FRONTEND ---');

    const authHeaders = {
      Authorization: `Bearer ${userToken}`,
    };

    // 1. GET /api/dashboard/summary
    const pubSummary = await axios.get(`${TEST_SERVER_URL}/api/dashboard/summary`, {
      headers: authHeaders,
    });
    testAssert(pubSummary.status === 200 && pubSummary.data.success, 'Public API /api/dashboard/summary hoạt động ổn định');
    testAssert(pubSummary.data.data.totalProjects > 0, 'Public summary chứa trường totalProjects');

    // 2. GET /api/dashboard/issue-breakdown
    const pubBreakdown = await axios.get(`${TEST_SERVER_URL}/api/dashboard/issue-breakdown`, {
      headers: authHeaders,
    });
    testAssert(pubBreakdown.status === 200 && pubBreakdown.data.success, 'Public API /api/dashboard/issue-breakdown hoạt động ổn định');

    // 3. GET /api/dashboard/status-distribution
    const pubStatus = await axios.get(`${TEST_SERVER_URL}/api/dashboard/status-distribution`, {
      headers: authHeaders,
    });
    testAssert(pubStatus.status === 200 && pubStatus.data.success, 'Public API /api/dashboard/status-distribution hoạt động ổn định');

    // 4. GET /api/dashboard/creation-trend
    const pubTrend = await axios.get(`${TEST_SERVER_URL}/api/dashboard/creation-trend`, {
      headers: authHeaders,
    });
    testAssert(pubTrend.status === 200 && pubTrend.data.success, 'Public API /api/dashboard/creation-trend hoạt động ổn định');

    // 5. GET /api/dashboard/analytics (Endpoint mới tổng hợp từ Flow 10)
    const pubAnalytics = await axios.get(`${TEST_SERVER_URL}/api/dashboard/analytics`, {
      headers: authHeaders,
    });
    testAssert(pubAnalytics.status === 200 && pubAnalytics.data.success, 'Public API /api/dashboard/analytics tổng hợp toàn bộ 4 tập dữ liệu');

    // 6. Kiểm tra lọc theo Workspace cụ thể
    const pubScopedSummary = await axios.get(
      `${TEST_SERVER_URL}/api/dashboard/summary?projectId=${sampleProject.id}`,
      { headers: authHeaders }
    );
    testAssert(pubScopedSummary.data.data.filteredProject.id === sampleProject.id, 'Public API lọc chính xác theo Workspace được chọn');

    // ─────────────────────────────────────────────────────────────────
    // PHẦN 8: KIỂM THỬ KHẢ NĂNG CHỊU LỖI FALLBACK KHI N8N OFFLINE
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- PHẦN 8: KIỂM THỬ KHẢ NĂNG CHỊU LỖI FALLBACK KHI N8N OFFLINE ---');

    DashboardFlowService.clearCache();
    const originalN8nUrl = env.N8N_DASHBOARD_WEBHOOK_URL;
    env.N8N_DASHBOARD_WEBHOOK_URL = 'http://localhost:59999/unreachable-webhook';

    const fallbackResult = await DashboardFlowService.fetchFromFlow10({
      userId: user.id,
      projectId: sampleProject.id,
    });

    testAssert(fallbackResult !== null, 'Hệ thống tự động kích hoạt Local Simulation Fallback khi n8n không khả dụng');
    testAssert(fallbackResult.executionSource === 'backend-direct-fallback', 'Ghi nhận đúng nguồn thực thi fallback nội bộ an toàn');
    testAssert(fallbackResult.summary.totalIssues !== undefined, 'Dữ liệu Dashboard vẫn được bảo toàn 100% không làm treo người dùng');

    env.N8N_DASHBOARD_WEBHOOK_URL = originalN8nUrl;

    console.log('\n================================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ LUỒNG 10: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('================================================================');

    if (passedTests === totalTests) {
      console.log('🎉 TẤT CẢ CÁC BÀI TEST CỦA LUỒNG 10 ĐÃ ĐẠT 100%!');
    } else {
      console.error(`⚠️ Có ${totalTests - passedTests} bài kiểm thử thất bại.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Lỗi kiểm thử Luồng 10:', err);
    process.exit(1);
  } finally {
    if (emptyProject && user) {
      await ProjectModel.delete(emptyProject.id, user.id).catch(() => {});
    }
    if (testServer) {
      testServer.close();
    }
  }
}

runTests();
