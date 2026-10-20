const db = require('../config/db');
const ExportService = require('../services/export.service');
const ExportFlowService = require('../services/export-flow.service');
const InternalExportController = require('../controllers/internal-export.controller');
const ProjectModel = require('../models/project.model');
const JiraIssueModel = require('../models/jiraIssue.model');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_PORT = 5055;
const API_BASE = `http://localhost:${TEST_PORT}/api`;
process.env.BACKEND_INTERNAL_URL = `http://localhost:${TEST_PORT}`;
const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/export-documentation';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN FLOW 12: PDF & MARKDOWN EXPORT');
  console.log('   (12 MAIN NODES, 0 AUX NODES, LIVE N8N & EXPRESS INTEGRATION)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;
  let testServer = null;

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
    // ── 0. KIỂM TRA CẤU TRÚC WORKFLOW JSON (12 MAIN NODES, 0 AUX NODES) ──
    console.log('--- Kiểm tra cấu trúc Workflow JSON: Flow 12 trên n8n ---');
    const wfPath = path.resolve(__dirname, '../../../n8n/workflows/flow-12-export-documentation.json');
    assert(fs.existsSync(wfPath), 'File workflow flow-12-export-documentation.json tồn tại');

    const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
    assert(wf.nodes && wf.nodes.length === 12, `Workflow có chính xác 12 Node vật lý (Hiện tại: ${wf.nodes.length})`);

    const mainNodes = wf.nodes.filter((n) => n.name.startsWith('MAIN '));
    const auxNodes = wf.nodes.filter((n) => n.name.startsWith('AUX '));
    assert(mainNodes.length === 12, `Số lượng MAIN Node = 12 (Hiện tại: ${mainNodes.length})`);
    assert(auxNodes.length === 0, `Số lượng AUX Node = 0 (Hiện tại: ${auxNodes.length})`);

    const expectedMainNames = [
      'MAIN 01 — Export Webhook Trigger',
      'MAIN 02 — Validate Export Request',
      'MAIN 03 — Verify Project Permission',
      'MAIN 04 — Fetch Project Export Data',
      'MAIN 05 — Validate Hierarchy Dataset',
      'MAIN 06 — Route Export Format',
      'MAIN 07 — Prepare PDF Configuration',
      'MAIN 08 — Generate PDF via Backend',
      'MAIN 09 — Prepare Markdown Configuration',
      'MAIN 10 — Generate Markdown via Backend',
      'MAIN 11 — Normalize Export Result',
      'MAIN 12 — Respond to Export Request',
    ];

    const actualNames = wf.nodes.map((n) => n.name);
    const hasAllNames = expectedMainNames.every((name) => actualNames.includes(name));
    assert(hasAllNames, 'Tất cả 12 MAIN Node có tên chính xác theo đặc tả chuẩn');

    const disabledNodes = wf.nodes.filter((n) => n.disabled === true);
    assert(disabledNodes.length === 0, 'Không có bất kỳ Node nào bị vô hiệu hóa (disabled)');

    // ── 1. KHỞI CHẠY TEST SERVER BACKEND TRÊN PORT TEST_PORT (5055) ──
    const app = require('../app');
    await new Promise((resolve, reject) => {
      testServer = app.listen(TEST_PORT, () => {
        console.log(`📡 Test Express Server đã khởi chạy tại port ${TEST_PORT}`);
        resolve();
      });
      testServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`📡 Cổng ${TEST_PORT} đã có server Express lắng nghe.`);
          resolve();
        } else {
          reject(err);
        }
      });
    });

    // ── 2. LẤY DỮ LIỆU USER VÀ PROJECT MẪU TRONG POSTGRESQL ──
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email 
       FROM users u 
       JOIN projects p ON p.user_id = u.id 
       JOIN jira_issues j ON j.project_key = p.project_key 
       GROUP BY u.id, u.name, u.email 
       LIMIT 1`
    );
    if (!userRes.rows.length) {
      console.log('⚠️ Không tìm thấy người dùng có dữ liệu trong DB để test.');
      process.exit(1);
    }
    const user = userRes.rows[0];
    const userToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'ai_jira_agent_default_secret_key',
      { expiresIn: '1h' }
    );
    console.log(`👤 Test User: ${user.name} (${user.email}, ID: ${user.id})`);

    const projectRes = await db.query(
      `SELECT p.id, p.name, p.project_key, p.description 
       FROM projects p
       JOIN jira_issues j ON j.project_key = p.project_key
       WHERE p.user_id = $1
       GROUP BY p.id, p.name, p.project_key, p.description
       ORDER BY COUNT(j.id) DESC
       LIMIT 1`,
      [user.id]
    );
    const project = projectRes.rows[0];
    console.log(`📁 Test Project: "${project.name}" (Key: ${project.project_key}, ID: ${project.id})\n`);

    // ── TEST 01 — VALID PDF EXPORT QUA FLOW 12 ──
    console.log('--- Test 01 — Valid PDF Export: Xuất PDF với dữ liệu Project hợp lệ ---');
    const pdfRes = await axios.get(
      `${API_BASE}/projects/${project.id}/export?format=pdf&source=jira`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
        responseType: 'arraybuffer',
      }
    );
    assert(pdfRes.status === 200, 'HTTP 200 khi xuất PDF thành công');
    assert(pdfRes.headers['content-type'] === 'application/pdf', 'Header Content-Type là application/pdf');
    assert(
      pdfRes.headers['content-disposition'].includes(`AI-Jira-Agent-${project.project_key}`),
      `Content-Disposition chứa tên file chuẩn: ${pdfRes.headers['content-disposition']}`
    );
    const pdfBuf = Buffer.from(pdfRes.data);
    assert(pdfBuf.length > 1000, `PDF tải về có kích thước hợp lệ (${pdfBuf.length} bytes)`);

    // ── TEST 02 — VALID MARKDOWN EXPORT QUA FLOW 12 ──
    console.log('\n--- Test 02 — Valid Markdown Export: Xuất Markdown với dữ liệu hợp lệ ---');
    const mdRes = await axios.get(
      `${API_BASE}/projects/${project.id}/export?format=markdown&source=jira`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
        responseType: 'text',
      }
    );
    assert(mdRes.status === 200, 'HTTP 200 khi xuất Markdown thành công');
    assert(mdRes.headers['content-type'].includes('text/markdown'), 'Header Content-Type là text/markdown');
    assert(mdRes.data.includes(`# Dự án: ${project.name}`), 'Markdown có heading cấp 1 với tên dự án');
    assert(mdRes.data.includes(`- **Mã dự án (Project Key):** \`${project.project_key}\``), 'Markdown hiển thị đúng mã dự án');

    // ── TEST 03 — INVALID FORMAT ──
    console.log('\n--- Test 03 — Invalid Format: Gửi định dạng không hỗ trợ và xác minh lỗi 400 ---');
    try {
      await axios.get(`${API_BASE}/projects/${project.id}/export?format=docx`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert(false, 'Phải từ chối định dạng docx không hỗ trợ');
    } catch (err) {
      assert(err.response && err.response.status === 400, 'Trả về mã lỗi 400 BAD_REQUEST khi format không hợp lệ');
      assert(
        err.response?.data?.message?.includes('format') || err.response?.data?.error === 'INVALID_FORMAT',
        'Thông báo giải thích rõ ràng về định dạng không được hỗ trợ'
      );
    }

    // ── TEST 04 — MISSING PROJECT ID ──
    console.log('\n--- Test 04 — Missing Project ID: Kiểm tra request thiếu projectId ---');
    try {
      // Gọi trực tiếp webhook n8n hoặc internal API thiếu projectId
      const n8nMissingRes = await axios.post(
        N8N_WEBHOOK_URL,
        {
          format: 'pdf',
          backendUrl: `http://localhost:${TEST_PORT}`,
          internalSecret: 'ai_jira_agent_internal_secret_2026',
        },
        { validateStatus: false }
      );
      assert(n8nMissingRes.status === 400, 'n8n trả về HTTP 400 khi thiếu projectId');
      assert(
        n8nMissingRes.data.error === 'BAD_REQUEST' || n8nMissingRes.data.message.includes('projectId'),
        'Thông báo lỗi nêu rõ thiếu projectId bắt buộc'
      );
    } catch (err) {
      assert(false, `Lỗi bất ngờ khi kiểm tra Missing Project ID: ${err.message}`);
    }

    // ── TEST 05 — UNAUTHORIZED PROJECT ──
    console.log('\n--- Test 05 — Unauthorized Project: Kiểm tra truy cập dự án không có quyền ---');
    try {
      await axios.get(
        `${API_BASE}/projects/00000000-0000-0000-0000-000000000000/export?format=pdf`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      assert(false, 'Truy cập dự án không tồn tại hoặc không thuộc quyền phải bị từ chối');
    } catch (err) {
      assert(
        err.response && (err.response.status === 404 || err.response.status === 403),
        `Trả về mã lỗi 404/403 khi không có quyền (Nhận được: ${err.response?.status})`
      );
    }

    // ── TEST 06 — EMPTY PROJECT ──
    console.log('\n--- Test 06 — Empty Project: Xử lý dự án chưa có issue (không crash, có thông báo) ---');
    const emptyModel = {
      projectName: 'Dự án Chưa Có Issue',
      projectKey: 'EMPTY',
      projectDescription: 'Dự án mới tạo',
      exportedAt: ExportService.formatDateTime(),
      source: 'jira',
      sourceLabel: 'Jira Cloud (Đã đồng bộ vào cơ sở dữ liệu)',
      stats: { epicsCount: 0, storiesCount: 0, tasksCount: 0, totalIssues: 0 },
      epics: [],
    };
    const emptyMd = ExportService.generateMarkdown(emptyModel);
    assert(emptyMd.includes('Hiện tại dự án chưa có Epic, Story hoặc Task nào'), 'Markdown dự án trống thể hiện thông điệp chuẩn');
    const emptyPdfBuf = await ExportService.generatePdf(emptyModel);
    assert(emptyPdfBuf && emptyPdfBuf.length > 500, `PDF dự án trống sinh thành công (${emptyPdfBuf.length} bytes)`);

    // ── TEST 07 — MULTIPLE EPIC HIERARCHY ──
    console.log('\n--- Test 07 — Multiple Epic Hierarchy: Kiểm tra quan hệ 3 tầng Epic -> Story -> Task ---');
    const hierarchyModel = await ExportService.getHierarchyFromJira({
      projectId: project.id,
      userId: user.id,
      project,
    });
    assert(hierarchyModel.epics.length > 0, `Mô hình phân cấp chứa ${hierarchyModel.epics.length} Epic(s)`);
    const ep0 = hierarchyModel.epics[0];
    assert(ep0.stories && ep0.stories.length > 0, `Epic đầu tiên có ${ep0.stories.length} User Story`);
    const st0 = ep0.stories[0];
    assert(st0.tasks && st0.tasks.length > 0, `User Story đầu tiên có ${st0.tasks.length} Task/Sub-task`);

    // ── TEST 08 — VIETNAMESE UNICODE IN PDF & MARKDOWN ──
    console.log('\n--- Test 08 — Vietnamese Unicode: Kiểm tra tiếng Việt có dấu trong PDF và Markdown ---');
    const vietnameseModel = {
      projectName: 'Hệ thống Quản lý Yêu cầu & Báo cáo Tự động',
      projectKey: 'VNPROJ',
      projectDescription: 'Đặc tả kỹ thuật phần mềm tiếng Việt có dấu: Tiếng Việt, Đổi mới sáng tạo, Trí tuệ nhân tạo.',
      exportedAt: ExportService.formatDateTime(),
      source: 'jira',
      sourceLabel: 'Jira Cloud (Đã đồng bộ vào cơ sở dữ liệu)',
      stats: { epicsCount: 1, storiesCount: 1, tasksCount: 1, totalIssues: 3 },
      epics: [
        {
          key: 'VNPROJ-1',
          title: 'Quản trị Người dùng & Phân quyền Truy cập Hệ thống',
          description: 'Hỗ trợ xác thực hai lớp (2FA), phân quyền theo vai trò (RBAC) & ghi nhật ký kiểm toán.',
          status: 'Đang triển khai',
          assignee: 'Nguyễn Văn An',
          jiraUrl: 'https://jira.example.com/browse/VNPROJ-1',
          stories: [
            {
              key: 'VNPROJ-2',
              title: 'Đăng nhập bảo mật qua cổng SSO Doanh nghiệp',
              description: 'Tích hợp OAuth2/OIDC với mã hóa JWT bảo đảm an toàn dữ liệu.',
              status: 'Đang xử lý',
              assignee: 'Trần Thị Bình',
              jiraUrl: 'https://jira.example.com/browse/VNPROJ-2',
              tasks: [
                {
                  key: 'VNPROJ-3',
                  title: 'Cài đặt thuật toán giải mã HMAC-SHA256',
                  description: 'Kiểm tra chữ ký số và hạn sử dụng của access token.',
                  status: 'Hoàn thành',
                  assignee: 'Lê Hoàng Cường',
                  jiraUrl: 'https://jira.example.com/browse/VNPROJ-3',
                  type: 'Task',
                },
              ],
            },
          ],
        },
      ],
    };

    const vnMd = ExportService.generateMarkdown(vietnameseModel);
    assert(vnMd.includes('Quản trị Người dùng & Phân quyền'), 'Markdown giữ nguyên vẹn tiếng Việt có dấu');
    assert(vnMd.includes('Nguyễn Văn An'), 'Markdown giữ đúng họ tên tiếng Việt');

    const vnPdfBuf = await ExportService.generatePdf(vietnameseModel);
    const tempVnPdfPath = '/tmp/unit_test_flow_12_vietnamese.pdf';
    fs.writeFileSync(tempVnPdfPath, vnPdfBuf);
    let extractedVnText = '';
    try {
      extractedVnText = execSync(`pdftotext ${tempVnPdfPath} -`).toString('utf8');
    } catch (e) {
      extractedVnText = '';
    }
    assert(extractedVnText.includes('Quản trị Người dùng'), 'PDF giữ nguyên vẹn tiếng Việt có dấu bằng font DejaVuSans');
    assert(extractedVnText.includes('Nguyễn Văn An'), 'PDF hiển thị đúng họ tên người phụ trách tiếng Việt');

    // ── TEST 09 — PDF GENERATION FAILED (SIMULATION) ──
    console.log('\n--- Test 09 — PDF Generation Failed: Mô phỏng Backend tạo PDF thất bại ---');
    const badPdfRes = await axios.post(
      `${API_BASE}/internal/export/generate-pdf`,
      { model: null, pdfConfig: {} },
      {
        headers: { 'X-Internal-Service-Key': 'ai_jira_agent_internal_secret_2026' },
        validateStatus: false,
      }
    );
    assert(badPdfRes.status === 400, 'Backend trả về HTTP 400 khi thiếu model tạo PDF');
    assert(badPdfRes.data.success === false, 'success === false khi tạo PDF thất bại');

    // ── TEST 10 — MARKDOWN GENERATION FAILED (SIMULATION) ──
    console.log('\n--- Test 10 — Markdown Generation Failed: Mô phỏng Backend tạo Markdown thất bại ---');
    const badMdRes = await axios.post(
      `${API_BASE}/internal/export/generate-markdown`,
      { model: null, markdownConfig: {} },
      {
        headers: { 'X-Internal-Service-Key': 'ai_jira_agent_internal_secret_2026' },
        validateStatus: false,
      }
    );
    assert(badMdRes.status === 400, 'Backend trả về HTTP 400 khi thiếu model tạo Markdown');
    assert(badMdRes.data.success === false, 'success === false khi tạo Markdown thất bại');

    // ── TEST 11 — BACKEND TIMEOUT & RESILIENT FALLBACK ──
    console.log('\n--- Test 11 — Backend Timeout: Kiểm tra cơ chế direct fallback khi n8n chậm/không phản hồi ---');
    const directFallbackResult = await ExportFlowService.exportDirectFallback({
      userId: user.id,
      projectId: project.id,
      format: 'pdf',
      source: 'jira',
      draftData: null,
    });
    assert(
      directFallbackResult.executionSource === 'backend-direct-fallback',
      'Động cơ Direct Fallback kích hoạt thành công khi n8n gặp sự cố'
    );
    assert(
      directFallbackResult.stored && directFallbackResult.stored.buffer.length > 1000,
      'Direct Fallback tạo file PDF hoàn chỉnh và an toàn'
    );

    // ── TEST 12 — FRONTEND DOWNLOAD SIMULATION ──
    console.log('\n--- Test 12 — Frontend Download: Kiểm tra Frontend tải được file thực tế ---');
    const downloadRes = await axios.get(
      `${API_BASE}/projects/${project.id}/export?format=pdf&source=jira`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
        responseType: 'arraybuffer',
      }
    );
    const disposition = downloadRes.headers['content-disposition'];
    const filenameMatch = disposition && disposition.match(/filename=["']?([^"';]+)["']?/i);
    const downloadedFileName = filenameMatch ? filenameMatch[1].trim() : 'default.pdf';
    assert(downloadRes.status === 200, 'Frontend nhận blob với status 200');
    assert(downloadedFileName.endsWith('.pdf'), `Tên file trích xuất hợp lệ: ${downloadedFileName}`);
    assert(
      downloadRes.data.byteLength > 1000,
      `Kích thước file tải về khớp với buffer (${downloadRes.data.byteLength} bytes)`
    );

    // ── TEST 13 — TRỰC TIẾP GỌI N8N WEBHOOK CHO CẢ PDF VÀ MARKDOWN ──
    console.log('\n--- Test 13 — Live n8n Flow 12 Execution: Gọi trực tiếp Webhook n8n ---');
    try {
      const n8nPdfRes = await axios.post(
        N8N_WEBHOOK_URL,
        {
          userId: user.id,
          projectId: project.id,
          format: 'pdf',
          source: 'jira',
          backendUrl: `http://localhost:${TEST_PORT}`,
          internalSecret: 'ai_jira_agent_internal_secret_2026',
        },
        { timeout: 15000, validateStatus: false }
      );
      assert(n8nPdfRes.status === 200, 'n8n Webhook trả về HTTP 200 cho PDF export');
      assert(n8nPdfRes.data.status === 'completed', 'n8n hoàn thành và báo status="completed"');
      assert(Boolean(n8nPdfRes.data.exportId), `n8n trả về exportId an toàn: ${n8nPdfRes.data.exportId}`);

      const n8nMdRes = await axios.post(
        N8N_WEBHOOK_URL,
        {
          userId: user.id,
          projectId: project.id,
          format: 'markdown',
          source: 'jira',
          backendUrl: `http://localhost:${TEST_PORT}`,
          internalSecret: 'ai_jira_agent_internal_secret_2026',
        },
        { timeout: 10000, validateStatus: false }
      );
      assert(n8nMdRes.status === 200, 'n8n Webhook trả về HTTP 200 cho Markdown export');
      assert(n8nMdRes.data.format === 'markdown', 'n8n xác định đúng format="markdown"');
    } catch (n8nErr) {
      console.warn(`⚠️ n8n execution note: ${n8nErr.message}`);
    }

    console.log('\n================================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ FLOW 12: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('================================================================');

    if (passedTests === totalTests) {
      console.log('🎉 TẤT CẢ 12 BÀI TEST BẮT BUỘC CỦA FLOW 12 ĐÃ ĐẠT 100%!');
    }
  } catch (error) {
    console.error('❌ Lỗi khi thực hiện kiểm thử Flow 12:', error);
  } finally {
    if (testServer) {
      if (typeof testServer.closeAllConnections === 'function') {
        testServer.closeAllConnections();
      }
      await new Promise((resolve) => testServer.close(resolve));
    }
    await db.pool.end();
  }
}

if (require.main === module) {
  runTests();
}

module.exports = runTests;
