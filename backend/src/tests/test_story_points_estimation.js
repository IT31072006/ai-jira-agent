/**
 * Test Suite: Feature 2 - AI Gợi ý Story Points & Thời gian ước lượng (Effort Estimation)
 * Kiểm tra:
 * 1. AI fallback engine sinh Story Points (Fibonacci), Estimated Hours và Complexity Reason cho Stories và Tasks.
 * 2. Cây phân cấp (Local Hierarchy Engine) tính toán chính xác tổng Story Points và tổng giờ KPI.
 * 3. Mutation fallback (Flow 6) cho phép thêm và cập nhật Story Points / Giờ / Lý do.
 * 4. Export Service kết xuất chính xác thông tin Story Points và Giờ vào Markdown và PDF.
 */

const assert = require('assert');
const {
  getSmartFallback,
  getLocalHierarchyFallback,
  getLocalMutationFallback,
} = require('../services/ai.service');
const ExportService = require('../services/export.service');

async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử Feature 2: AI Story Points & Effort Estimation...\n');
  let passedTests = 0;

  // Test 1: getSmartFallback sinh Story Points và giờ cho kịch bản SmartRide
  console.log('--- Test 1: SmartRide Fallback sinh Story Points & Giờ hợp lệ ---');
  const smartRide = getSmartFallback('Xây dựng hệ thống SmartRide xe ôm công nghệ');
  assert(Array.isArray(smartRide.epics) && smartRide.epics.length > 0, 'Phải có epics');
  
  let totalSp = 0;
  let totalHours = 0;
  smartRide.epics.forEach((epic) => {
    epic.stories.forEach((story) => {
      assert(typeof story.storyPoints === 'number' && story.storyPoints > 0, 'Story phải có storyPoints > 0');
      assert(typeof story.estimatedHours === 'number' && story.estimatedHours > 0, 'Story phải có estimatedHours > 0');
      assert(typeof story.complexityReason === 'string' && story.complexityReason.length > 0, 'Story phải có complexityReason');
      totalSp += story.storyPoints;
      totalHours += story.estimatedHours;

      story.tasks.forEach((task) => {
        assert(typeof task.storyPoints === 'number' && task.storyPoints > 0, 'Task phải có storyPoints > 0');
        assert(typeof task.estimatedHours === 'number' && task.estimatedHours > 0, 'Task phải có estimatedHours > 0');
        assert(typeof task.complexityReason === 'string' && task.complexityReason.length > 0, 'Task phải có complexityReason');
      });
    });
  });
  console.log(`✓ Kịch bản SmartRide có tổng ${totalSp} SP và ${totalHours} giờ ước lượng.`);
  passedTests++;

  // Test 2: getLocalHierarchyFallback tính toán kpiMetrics.totalStoryPoints & totalEstimatedHours
  console.log('\n--- Test 2: Local Hierarchy Engine tính toán KPI Metrics chuẩn xác ---');
  const treeResult = getLocalHierarchyFallback(smartRide.epics, { requestId: 'req-test-123' });
  assert(treeResult.success === true, 'Tree conversion phải thành công');
  assert(typeof treeResult.kpiMetrics.totalStoryPoints === 'number' && treeResult.kpiMetrics.totalStoryPoints > 0, 'KPI phải có totalStoryPoints');
  assert(typeof treeResult.kpiMetrics.totalEstimatedHours === 'number' && treeResult.kpiMetrics.totalEstimatedHours > 0, 'KPI phải có totalEstimatedHours');
  assert.strictEqual(treeResult.kpiMetrics.totalStoryPoints, totalSp, 'Tổng SP trong KPI phải khớp với tổng SP các Story');
  assert.strictEqual(treeResult.kpiMetrics.totalEstimatedHours, totalHours, 'Tổng giờ trong KPI phải khớp với tổng giờ các Story');
  console.log(`✓ KPI Metrics: totalStoryPoints = ${treeResult.kpiMetrics.totalStoryPoints}, totalEstimatedHours = ${treeResult.kpiMetrics.totalEstimatedHours}`);
  passedTests++;

  // Test 3: getLocalMutationFallback cập nhật Story Points và Giờ cho Story & Task
  console.log('\n--- Test 3: Local Mutation Fallback (Flow 6) cập nhật SP và Hours ---');
  const firstEpic = treeResult.treeData[0];
  const firstStory = firstEpic.stories[0];
  const firstTask = firstStory.tasks[0];

  const mutatedUpdate = getLocalMutationFallback(
    'UPDATE',
    'STORY',
    treeResult.treeData,
    {
      storyId: firstStory.id,
      data: {
        storyPoints: 8,
        estimatedHours: 32,
        complexityReason: 'Đã nâng độ phức tạp sau khi review kiến trúc',
      },
    }
  );
  assert(mutatedUpdate.success === true, 'UPDATE Story phải thành công');
  const updatedStory = mutatedUpdate.treeData[0].stories.find((s) => s.id === firstStory.id);
  assert.strictEqual(updatedStory.storyPoints, 8, 'Story points phải được cập nhật thành 8');
  assert.strictEqual(updatedStory.estimatedHours, 32, 'Estimated hours phải được cập nhật thành 32');
  assert.strictEqual(updatedStory.complexityReason, 'Đã nâng độ phức tạp sau khi review kiến trúc');

  const mutatedTaskUpdate = getLocalMutationFallback(
    'UPDATE',
    'TASK',
    mutatedUpdate.treeData,
    {
      taskId: firstTask.id,
      data: {
        storyPoints: 5,
        estimatedHours: 16,
        complexityReason: 'Task cần kết nối API bên thứ ba',
      },
    }
  );
  assert(mutatedTaskUpdate.success === true, 'UPDATE Task phải thành công');
  const updatedTask = mutatedTaskUpdate.treeData[0].stories[0].tasks.find((t) => t.id === firstTask.id);
  assert.strictEqual(updatedTask.storyPoints, 5, 'Task points phải là 5');
  assert.strictEqual(updatedTask.estimatedHours, 16, 'Task hours phải là 16');
  console.log('✓ Mutation Flow 6 cập nhật thành công Story Points và giờ cho Story và Task.');
  passedTests++;

  // Test 4: ExportService xuất tài liệu Markdown và PDF chứa Story Points và Giờ
  console.log('\n--- Test 4: Export Service kết xuất Markdown & PDF với Agile Estimation ---');
  const normalizedExport = ExportService.normalizeHierarchyFromDraft({
    draftData: smartRide.epics,
    project: { name: 'SmartRide Pro', project_key: 'SRIDE', description: 'Ứng dụng đặt xe thông minh' },
  });
  assert(normalizedExport.stats.totalStoryPoints > 0, 'Export stats phải có totalStoryPoints');
  assert(normalizedExport.stats.totalEstimatedHours > 0, 'Export stats phải có totalEstimatedHours');

  const markdown = ExportService.generateMarkdown(normalizedExport);
  assert(markdown.includes('Tổng Story Points:'), 'Markdown phải chứa Tổng Story Points');
  assert(markdown.includes('Ước lượng Agile:'), 'Markdown phải chứa mục Ước lượng Agile trong Story');
  assert(markdown.includes('SP'), 'Markdown phải chứa đơn vị SP');
  console.log('✓ Markdown kết xuất thành công thông tin Story Points.');

  const pdfBuffer = await ExportService.generatePdf(normalizedExport);
  assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 1000, 'PDF buffer phải được sinh hợp lệ');
  console.log(`✓ PDF tài liệu được sinh thành công (${pdfBuffer.length} bytes) kèm Agile Estimation.`);
  passedTests++;

  console.log(`\n🎉 HOÀN THÀNH: Tất cả ${passedTests}/4 bài kiểm thử Feature 2 ĐẠT 100%!`);
}

runTests().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
