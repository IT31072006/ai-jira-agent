const assert = require('assert');
const { getSmartFallback, getLocalHierarchyFallback } = require('../services/ai.service');
const ExportService = require('../services/export.service');

async function runAcceptanceCriteriaTests() {
  console.log('🧪 [TEST] Bắt đầu kiểm thử Tính năng 1: Acceptance Criteria (BDD)...');

  // Test 1: getSmartFallback cho kịch bản SmartRide
  const smartRideResult = getSmartFallback('Xây dựng hệ thống SmartRide đặt xe và thanh toán');
  assert(smartRideResult.epics && smartRideResult.epics.length > 0, 'Phải có epics');
  
  let totalStories = 0;
  let storiesWithAc = 0;

  smartRideResult.epics.forEach((epic) => {
    epic.stories.forEach((story) => {
      totalStories++;
      if (story.acceptance_criteria && Array.isArray(story.acceptance_criteria) && story.acceptance_criteria.length > 0) {
        storiesWithAc++;
        story.acceptance_criteria.forEach((ac) => {
          assert(ac.includes('Given') && ac.includes('When') && ac.includes('Then'), `AC phải tuân thủ chuẩn BDD Given-When-Then: ${ac}`);
        });
      }
    });
  });

  assert.strictEqual(storiesWithAc, totalStories, 'Toàn bộ User Story phải có Acceptance Criteria chuẩn BDD');
  console.log(`✅ [PASS] Test 1: getSmartFallback sinh thành công ${storiesWithAc}/${totalStories} User Story có tiêu chí nghiệm thu Given-When-Then.`);

  // Test 2: getLocalHierarchyFallback chuyển đổi và bảo toàn Acceptance Criteria
  const hierarchyResult = getLocalHierarchyFallback(smartRideResult.epics);
  assert(hierarchyResult.success === true, 'Hierarchy conversion phải thành công');
  assert(hierarchyResult.treeData && hierarchyResult.treeData.length > 0, 'Phải có treeData');

  hierarchyResult.treeData.forEach((epic) => {
    epic.stories.forEach((story) => {
      assert(story.acceptanceCriteria && Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0, 'Cây phân cấp phải giữ acceptanceCriteria');
      assert(story.acceptance_criteria && Array.isArray(story.acceptance_criteria), 'Cây phân cấp phải giữ acceptance_criteria');
    });
  });
  console.log('✅ [PASS] Test 2: getLocalHierarchyFallback bảo toàn Acceptance Criteria trên từng node Story trong cây phân cấp.');

  // Test 3: Export Markdown chứa Acceptance Criteria
  const mockProject = { id: 'p1', name: 'SmartRide Platform', project_key: 'SMR', description: 'Mô tả dự án' };
  const mockDraftData = smartRideResult.epics;

  const exportModel = ExportService.normalizeHierarchyFromDraft({
    draftData: mockDraftData,
    project: mockProject,
  });

  const mdResult = ExportService.generateMarkdown(exportModel);

  assert(mdResult.includes('Tiêu chí nghiệm thu (Acceptance Criteria - BDD)'), 'Markdown phải chứa tiêu đề Tiêu chí nghiệm thu');
  assert(mdResult.includes('Given'), 'Markdown phải chứa Given');
  assert(mdResult.includes('When'), 'Markdown phải chứa When');
  assert(mdResult.includes('Then'), 'Markdown phải chứa Then');
  console.log('✅ [PASS] Test 3: Export Markdown định dạng đầy đủ tiêu chí nghiệm thu BDD.');

  // Test 4: Export PDF chứa Acceptance Criteria không gây lỗi
  const pdfBuffer = await ExportService.generatePdf(exportModel);

  assert(pdfBuffer && pdfBuffer.length > 0, 'PDF buffer phải được tạo');
  console.log(`✅ [PASS] Test 4: Export PDF thành công với kích thước ${pdfBuffer.length} bytes, tích hợp Acceptance Criteria.`);

  console.log('\n🎉 [HOÀN TẤT] Tất cả các bài kiểm thử Tính năng 1 (Acceptance Criteria BDD) ĐÃ ĐẠT 100%!');
}

runAcceptanceCriteriaTests().catch((err) => {
  console.error('❌ [FAIL] Kiểm thử thất bại:', err);
  process.exit(1);
});
