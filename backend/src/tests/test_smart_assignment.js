const assert = require('assert');
const db = require('../config/db');
const JiraService = require('../services/jira.service');
const SmartAssignService = require('../services/smartAssign.service');
const MemberProfileModel = require('../models/memberProfile.model');

async function runSmartAssignmentTest() {
  console.log('================================================================');
  console.log('🚀 KIỂM THỬ TỰ ĐỘNG PHÂN CÔNG THÔNG MINH (AI SMART ASSIGNMENT)');
  console.log('================================================================\n');

  const userRes = await db.query('SELECT id FROM users LIMIT 1');
  const userId = userRes.rows[0]?.id;
  if (!userId) {
    throw new Error('Cần ít nhất một user trong database để chạy kiểm thử.');
  }

  try {
    // ── Test 1: Kiểm tra làm giàu hồ sơ thành viên (Enrichment) ──────────────
    console.log('--- Test 1: Làm giàu hồ sơ thành viên từ CSDL ---');
    const rawMembers = [
      { accountId: 'usr-quan-02', displayName: 'Phạm Huỳnh Quân', emailAddress: 'phamhuynhquan310706@gmail.com' },
      { accountId: 'usr-thang-01', displayName: 'Trần Minh Thắng', emailAddress: 'tranthang20060903@gmail.com' },
      { accountId: 'usr-bao-03', displayName: 'Lê Gia Bảo', emailAddress: 'giabao.dev@gmail.com' },
      { accountId: 'usr-sang-04', displayName: 'Nguyễn Văn Sáng', emailAddress: 'vansang.ai@gmail.com' },
    ];

    const enriched = await SmartAssignService.enrichMembersWithStrengths({
      userId,
      projectKey: 'KAN',
      rawMembers,
    });

    assert.strictEqual(enriched.length, 4, 'Phải có đủ 4 thành viên');
    const quan = enriched.find((m) => m.accountId === 'usr-quan-02');
    const thang = enriched.find((m) => m.accountId === 'usr-thang-01');
    const bao = enriched.find((m) => m.accountId === 'usr-bao-03');

    assert.ok(quan.primaryStrength.includes('Backend') || quan.primaryStrength.includes('CSDL'), 'Quân phải có thế mạnh Backend');
    assert.ok(thang.primaryStrength.includes('Frontend') || thang.primaryStrength.includes('UI'), 'Thắng phải có thế mạnh Frontend/UI');
    assert.ok(bao.primaryStrength.includes('Thanh toán') || bao.primaryStrength.includes('DevOps'), 'Bảo phải có thế mạnh Thanh toán/DevOps');
    console.log('✅ [PASS] Làm giàu hồ sơ thành viên thành công với đầy đủ thế mạnh và kỹ năng!\n');

    // ── Test 2: Tự động phân công thông minh & Chống xung đột merge code ─────
    console.log('--- Test 2: Thuật toán phân công thông minh & Chống xung đột merge code ---');
    const sampleEpics = [
      {
        name: 'Hệ thống Xác thực & Quản lý Tài khoản',
        description: 'Module backend đăng nhập, bảo mật JWT và CSDL người dùng',
        stories: [
          {
            title: 'Đăng nhập bảo mật JWT và Phân quyền',
            description: 'Xây dựng API xác thực JWT, refresh token và schema bảng users',
            tasks: [
              { title: 'Tạo schema database PostgreSQL cho users và roles', description: 'Migration bảng CSDL' },
              { title: 'Phát triển API POST /api/auth/login xác thực mật khẩu', description: 'Backend controller và token' },
              { title: 'Thiết kế form giao diện Đăng nhập', description: 'Giao diện React CSS' },
            ],
          },
        ],
      },
      {
        name: 'Tích hợp Cổng Thanh toán Điện tử',
        description: 'Xử lý thanh toán tiền cọc đơn hàng qua MoMo và Webhook',
        stories: [
          {
            title: 'Thanh toán MoMo QR và Xác thực giao dịch',
            description: 'Tạo payment link và lắng nghe IPN webhook từ MoMo',
            tasks: [
              { title: 'API khởi tạo thanh toán MoMo QR', description: 'Kết nối cổng thanh toán' },
              { title: 'Webhook xử lý kết quả thanh toán từ MoMo', description: 'Xác minh chữ ký số webhook' },
            ],
          },
        ],
      },
    ];

    const assignResult = SmartAssignService.autoAssign({
      epics: sampleEpics,
      members: enriched,
      projectKey: 'KAN',
      userId,
    });

    const story1 = assignResult.epics[0].stories[0];
    const story2 = assignResult.epics[1].stories[0];

    console.log(`Story 1: "${story1.title}" => Gán cho: ${story1.assigneeName} (${story1.assigneeRole})`);
    console.log(`Story 2: "${story2.title}" => Gán cho: ${story2.assigneeName} (${story2.assigneeRole})`);

    // Kiểm tra nguyên tắc 1: Khớp thế mạnh
    assert.strictEqual(story1.assigneeName, 'Phạm Huỳnh Quân', 'Story Xác thực/Backend phải được giao cho Phạm Huỳnh Quân');
    assert.strictEqual(story2.assigneeName, 'Lê Gia Bảo', 'Story Thanh toán/MoMo phải được giao cho Lê Gia Bảo');

    // Kiểm tra nguyên tắc 2: Chống xung đột code (Các tasks con của Story 1 đều cùng 1 người)
    story1.tasks.forEach((task) => {
      assert.strictEqual(
        task.assigneeId,
        story1.assigneeId,
        `Task "${task.title}" phải cùng người phụ trách Story (${story1.assigneeName}) để chống conflict merge code`
      );
    });

    // Các tasks con của Story 2 đều cùng Lê Gia Bảo
    story2.tasks.forEach((task) => {
      assert.strictEqual(
        task.assigneeId,
        story2.assigneeId,
        `Task "${task.title}" phải cùng người phụ trách Story (${story2.assigneeName}) để chống conflict merge code`
      );
    });

    console.log('✅ [PASS] Tất cả các sub-task trong cùng Story đều được gom cho cùng 1 Developer để tránh conflict merge code!');
    console.log('✅ [PASS] Khớp chính xác thế mạnh chuyên môn của từng thành viên!\n');

    // ── Test 3: Học hỏi liên tục từ các lần gán (Continuous Learning) ─────────
    console.log('--- Test 3: Học hỏi liên tục và cập nhật điểm số thế mạnh vào CSDL ---');
    const newTasks = [
      { accountId: 'usr-thang-01', displayName: 'Trần Minh Thắng', title: 'Thiết kế giao diện Dark Mode', description: 'CSS và theme giao diện' },
      { accountId: 'usr-thang-01', displayName: 'Trần Minh Thắng', title: 'Tối ưu UI Component Modal', description: 'Giao diện popup responsive' },
    ];

    await MemberProfileModel.recordAssignments(userId, 'KAN', newTasks);
    const updatedThang = await MemberProfileModel.findByAccountId(userId, 'usr-thang-01');
    assert.ok(updatedThang.total_assigned_tasks >= 16, 'Số task của Thắng phải tăng lên');
    assert.ok(updatedThang.strength_scores.frontend >= 16, 'Điểm Frontend của Thắng phải tăng');
    console.log(`✅ [PASS] Đã ghi nhận học hỏi thành công! Thắng hiện có ${updatedThang.total_assigned_tasks} tasks và điểm Frontend=${updatedThang.strength_scores.frontend}\n`);

    // ── Test 4: JiraService.autoAssignTree tích hợp toàn diện ────────────────
    console.log('--- Test 4: Kiểm tra JiraService.autoAssignTree qua API service ---');
    const serviceRes = await JiraService.autoAssignTree({
      userId,
      projectKey: 'KAN',
      epics: sampleEpics,
    });

    assert.strictEqual(serviceRes.success, true, 'autoAssignTree phải trả về success: true');
    assert.ok(serviceRes.epics.length > 0, 'Phải có epics trả về');
    assert.ok(serviceRes.rationaleSummary.includes('thành công'), 'Phải có rationaleSummary');
    console.log('Rationale:', serviceRes.rationaleSummary);
    console.log('✅ [PASS] Toàn bộ luồng Tự động phân công thông minh hoạt động hoàn hảo 100%!');

    console.log('\n================================================================');
    console.log('🎉 TẤT CẢ CÁC BÀI TEST TỰ ĐỘNG PHÂN CÔNG ĐÃ ĐẠT PASS 100%!');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Kiểm thử thất bại:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runSmartAssignmentTest();
