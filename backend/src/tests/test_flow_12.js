const db = require('../config/db');
const ExportService = require('../services/export.service');
const ProjectModel = require('../models/project.model');
const JiraIssueModel = require('../models/jiraIssue.model');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ LUỒNG 12: EXPORT DOCUMENTATION (PDF & MARKDOWN)');
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
    const userToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );
    console.log(`👤 Sử dụng test user: ${user.name} (${user.email}, ID: ${user.id})`);

    // 2. Lấy project mẫu có issue
    const projectRes = await db.query(
      'SELECT id, name, project_key, description FROM projects WHERE user_id = $1 LIMIT 1',
      [user.id]
    );
    if (!projectRes.rows.length) {
      console.log('⚠️ Không tìm thấy project nào của user để test.');
      process.exit(1);
    }
    const project = projectRes.rows[0];
    console.log(`📁 Sử dụng test project: "${project.name}" (Key: ${project.project_key}, ID: ${project.id})\n`);

    // --- TEST 1: Cấu trúc phân cấp 3 tầng từ CSDL (Epic -> Story -> Task) ---
    console.log('--- Test 1: Truy vấn cấu trúc phân cấp từ PostgreSQL (source=jira) ---');
    const jiraModel = await ExportService.getHierarchyFromJira({
      projectId: project.id,
      userId: user.id,
      project: project,
    });
    assert(jiraModel.source === 'jira', 'Nguồn dữ liệu xác định đúng là "jira"');
    assert(jiraModel.stats.totalIssues > 0, `Project có ${jiraModel.stats.totalIssues} issue(s)`);
    assert(jiraModel.epics.length > 0, `Truy vấn thành công ${jiraModel.epics.length} Epic(s)`);
    const firstEpic = jiraModel.epics[0];
    assert(firstEpic.stories && firstEpic.stories.length > 0, `Epic "${firstEpic.title}" chứa ${firstEpic.stories.length} User Story`);
    const firstStory = firstEpic.stories[0];
    assert(firstStory.tasks && firstStory.tasks.length > 0, `Story "${firstStory.title}" chứa ${firstStory.tasks.length} Task/Sub-task`);

    // --- TEST 2: Đảm bảo quan hệ parent-child được giữ đúng ---
    console.log('\n--- Test 2: Kiểm tra quan hệ parent-child đúng giữa Epic, Story và Task ---');
    assert(firstStory.parentKey === firstEpic.key, `Story "${firstStory.key}" có parent_key trỏ đúng về Epic "${firstEpic.key}"`);
    const firstTask = firstStory.tasks[0];
    assert(firstTask.parentKey === firstStory.key, `Task "${firstTask.key}" có parent_key trỏ đúng về Story "${firstStory.key}"`);

    // --- TEST 3: Tạo và kiểm tra tài liệu Markdown ---
    console.log('\n--- Test 3: Tạo file Markdown từ dữ liệu thực tế ---');
    const markdownOutput = ExportService.generateMarkdown(jiraModel);
    assert(markdownOutput.includes(`# Dự án: ${project.name}`), 'Markdown có heading cấp 1 với tên dự án');
    assert(markdownOutput.includes(`- **Mã dự án (Project Key):** \`${project.project_key}\``), 'Markdown hiển thị mã dự án chính xác');
    assert(markdownOutput.includes('Nguồn dữ liệu (Data Source):'), 'Markdown có thông tin nguồn dữ liệu');
    assert(markdownOutput.includes(`## Epic 1:`), 'Markdown chứa heading cấp 2 cho Epic');
    assert(markdownOutput.includes(`### Story 1.1:`), 'Markdown chứa heading cấp 3 cho User Story');
    assert(markdownOutput.includes(`- **Task 1.1.1:**`), 'Markdown chứa danh sách Task thuộc Story');

    // --- TEST 4: Tạo và kiểm tra PDF với tiếng Việt Unicode ---
    console.log('\n--- Test 4: Tạo file PDF và xác minh hiển thị tiếng Việt có dấu ---');
    const pdfBuffer = await ExportService.generatePdf(jiraModel);
    assert(pdfBuffer && pdfBuffer.length > 1000, `PDF được tạo thành công với kích thước ${pdfBuffer.length} bytes`);

    // Lưu file PDF tạm và dùng pdftotext kiểm tra không bị lỗi font
    const tempPdfPath = '/tmp/unit_test_flow_12.pdf';
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    let extractedPdfText = '';
    try {
      extractedPdfText = execSync(`pdftotext ${tempPdfPath} -`).toString('utf8');
    } catch (e) {
      extractedPdfText = '';
    }
    assert(extractedPdfText.includes('TÀI LIỆU YÊU CẦU PHẦN MỀM'), 'PDF chứa tiêu đề chính chuẩn UTF-8');
    assert(extractedPdfText.includes(project.project_key), 'PDF chứa mã dự án chính xác');
    assert(extractedPdfText.includes('Trang 1 /'), 'PDF chứa số trang phân trang tự động');

    // --- TEST 5: Tính nhất quán giữa PDF và Markdown ---
    console.log('\n--- Test 5: Tính nhất quán số liệu giữa PDF và Markdown ---');
    assert(
      markdownOutput.includes(`${jiraModel.stats.epicsCount} Epic`) || markdownOutput.includes(`Epic: ${jiraModel.stats.epicsCount}`),
      'Markdown phản ánh đúng số lượng Epics'
    );
    assert(
      extractedPdfText.includes(`${jiraModel.stats.epicsCount} Epic`),
      'PDF phản ánh đúng số lượng Epics khớp 100% với Markdown'
    );
    assert(
      extractedPdfText.includes(`${jiraModel.stats.storiesCount} User Story`),
      'PDF phản ánh đúng số lượng User Story khớp 100% với Markdown'
    );

    // --- TEST 6: Phân quyền API GET /api/projects/:projectId/export ---
    console.log('\n--- Test 6: Kiểm tra xác thực và phân quyền qua HTTP API ---');
    // 6.1: Gọi hợp lệ với Bearer token của owner
    const apiRes = await axios.get(
      `${API_BASE}/projects/${project.id}/export?format=markdown&source=jira`,
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    assert(apiRes.status === 200, 'Chủ sở hữu dự án gọi GET export thành công (Status 200)');
    assert(
      apiRes.headers['content-type'].includes('text/markdown'),
      'Content-Type trả về đúng text/markdown; charset=utf-8'
    );
    assert(
      apiRes.headers['content-disposition'].includes(`AI-Jira-Agent-${project.project_key}`),
      `Content-Disposition chứa tên file chuẩn quy ước: ${apiRes.headers['content-disposition']}`
    );

    // 6.2: Gọi không có Token (401)
    try {
      await axios.get(`${API_BASE}/projects/${project.id}/export?format=markdown&source=jira`);
      assert(false, 'Gọi không có token phải bị từ chối');
    } catch (err) {
      assert(err.response && err.response.status === 401, 'Từ chối truy cập 401 khi không có JWT token');
    }

    // 6.3: Gọi với project không tồn tại (404)
    try {
      await axios.get(
        `${API_BASE}/projects/00000000-0000-0000-0000-000000000000/export?format=markdown&source=jira`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      assert(false, 'Project không tồn tại phải trả về 404');
    } catch (err) {
      assert(err.response && err.response.status === 404, 'Trả về 404 khi truy cập project không thuộc quyền');
    }

    // --- TEST 7: Kiểm tra an toàn bảo mật (Không rò rỉ token, secret) ---
    console.log('\n--- Test 7: Kiểm tra bảo mật (Không chứa API Token hay Mật khẩu) ---');
    assert(!markdownOutput.includes('jwt') && !markdownOutput.includes('Bearer'), 'Markdown không chứa JWT hoặc Bearer token');
    assert(!markdownOutput.includes('jira_api_token') && !markdownOutput.includes('password_hash'), 'Markdown không chứa thông tin bí mật Jira API Token');
    assert(!extractedPdfText.includes('jira_api_token'), 'PDF không chứa thông tin cấu hình nhạy cảm');

    // --- TEST 8: Xử lý dự án không có issue (Empty project) ---
    console.log('\n--- Test 8: Xử lý dự án chưa có issue (Không bị lỗi/crash) ---');
    const emptyModel = {
      projectName: 'Dự án Trống',
      projectKey: 'EMPTY',
      projectDescription: '',
      exportedAt: ExportService.formatDateTime(),
      source: 'jira',
      sourceLabel: 'Jira Cloud (Đã đồng bộ vào cơ sở dữ liệu)',
      stats: { epicsCount: 0, storiesCount: 0, tasksCount: 0, totalIssues: 0 },
      epics: [],
    };
    const emptyMd = ExportService.generateMarkdown(emptyModel);
    assert(emptyMd.includes('Hiện tại dự án chưa có Epic, Story hoặc Task nào'), 'Markdown xử lý dự án trống với thông báo rõ ràng');
    const emptyPdf = await ExportService.generatePdf(emptyModel);
    assert(emptyPdf && emptyPdf.length > 500, 'PDF cho dự án trống được tạo thành công');

    // --- TEST 9: Xuất dữ liệu bản nháp AI (source=draft) độc lập ---
    console.log('\n--- Test 9: Xuất dữ liệu bản nháp AI (source=draft) ---');
    const sampleDraftData = [
      {
        title: 'Epic Tự Động Hóa AI',
        description: 'Mô tả bản nháp tự động sinh bởi Gemini',
        stories: [
          {
            title: 'Story Trợ lý ảo',
            description: 'Người dùng gửi prompt để AI phân tích',
            tasks: ['Thiết kế giao diện chat', 'Kết nối API Gemini'],
          },
        ],
      },
    ];
    const draftModel = ExportService.normalizeHierarchyFromDraft({
      draftData: sampleDraftData,
      project,
    });
    assert(draftModel.source === 'draft', 'Nguồn dữ liệu xác định đúng là "draft"');
    assert(draftModel.sourceLabel.includes('Bản nháp AI'), 'Nhãn nguồn dữ liệu thể hiện rõ là Bản nháp AI');
    assert(draftModel.stats.epicsCount === 1, 'Đếm đúng 1 Epic trong bản nháp');
    assert(draftModel.stats.storiesCount === 1, 'Đếm đúng 1 Story trong bản nháp');
    assert(draftModel.stats.tasksCount === 2, 'Đếm đúng 2 Task trong bản nháp');

    const draftMd = ExportService.generateMarkdown(draftModel);
    assert(draftMd.includes('Bản nháp AI (Chưa đẩy lên Jira)'), 'Markdown bản nháp ghi nhận nguồn dữ liệu bản nháp');
    assert(draftMd.includes('Epic Tự Động Hóa AI'), 'Markdown hiển thị đúng tiêu đề Epic bản nháp');

    // --- TEST 10: Issue có mô tả tiếng Việt dài và ký tự đặc biệt ---
    console.log('\n--- Test 10: Xử lý tiếng Việt có dấu, ký tự đặc biệt & văn bản dài ---');
    const complexModel = {
      projectName: 'Hệ thống Quản lý Bán hàng & Dịch vụ Khách hàng (CRM & ERP)',
      projectKey: 'CRM',
      projectDescription: 'Tích hợp cổng VNPay/MoMo, hóa đơn điện tử & trí tuệ nhân tạo <AI Engine>.',
      exportedAt: ExportService.formatDateTime(),
      source: 'jira',
      sourceLabel: 'Jira Cloud (Đã đồng bộ vào cơ sở dữ liệu)',
      stats: { epicsCount: 1, storiesCount: 1, tasksCount: 1, totalIssues: 3 },
      epics: [
        {
          key: 'CRM-1',
          title: 'Quản lý Đơn hàng & Thanh toán Trực tuyến (VNPay / Ví MoMo)',
          description: 'Hỗ trợ các phương thức: Thẻ nội địa ATM, Thẻ quốc tế Visa/Mastercard, QR Code thanh toán tức thì với mức phí ưu đãi 0.5% & hoàn tiền tự động khi hủy đơn hàng.',
          status: 'Đang triển khai',
          assignee: 'Nguyễn Đắc Thắng',
          jiraUrl: 'https://jira.example.com/browse/CRM-1',
          stories: [
            {
              key: 'CRM-2',
              title: 'Người mua chọn phương thức quét mã QR VNPAY-QR',
              description: 'Ứng dụng sinh chuỗi Base64 hình ảnh mã QR Code & kiểm tra Webhook IPN từ ngân hàng trong vòng 300 giây.',
              status: 'Đang xử lý',
              assignee: 'Trần Minh Thắng',
              jiraUrl: 'https://jira.example.com/browse/CRM-2',
              tasks: [
                {
                  key: 'CRM-3',
                  title: 'Viết API xác thực chữ ký SHA256 cho IPN Webhook',
                  description: 'Kiểm tra checksum dữ liệu truyền về từ cổng thanh toán nhằm chống tấn công giả mạo (Man-in-the-Middle).',
                  status: 'Hoàn thành',
                  assignee: 'Kỹ sư Backend',
                  jiraUrl: 'https://jira.example.com/browse/CRM-3',
                  type: 'Subtask',
                },
              ],
            },
          ],
        },
      ],
    };

    const complexMd = ExportService.generateMarkdown(complexModel);
    assert(complexMd.includes('VNPAY-QR'), 'Markdown hiển thị đầy đủ văn bản phức tạp');
    const complexPdf = await ExportService.generatePdf(complexModel);
    fs.writeFileSync('/tmp/test_complex.pdf', complexPdf);
    const complexExtracted = execSync('pdftotext /tmp/test_complex.pdf -').toString('utf8');
    assert(complexExtracted.includes('Man-in-the-Middle'), 'PDF bảo toàn nguyên vẹn văn bản kỹ thuật & ký tự đặc biệt');
    assert(complexExtracted.includes('Nguyễn Đắc Thắng'), 'PDF hiển thị họ tên tiếng Việt có dấu chính xác');

    console.log('\n=====================================================');
    console.log(`🎯 KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('=====================================================');

    if (passedTests === totalTests) {
      console.log('🎉 TẤT CẢ CÁC BÀI TEST CỦA LUỒNG 12 ĐÃ ĐẠT 100%!');
    }
  } catch (error) {
    console.error('❌ Lỗi khi thực hiện kiểm thử:', error);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  runTests();
}

module.exports = runTests;
