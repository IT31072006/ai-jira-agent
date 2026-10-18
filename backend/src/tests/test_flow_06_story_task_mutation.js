const assert = require('assert');
const { mutateStoryTask, getLocalMutationFallback } = require('../services/ai.service');

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ LUỒNG 6: STORY & TASK MUTATION & REFINEMENT');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function testAssert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // Dữ liệu cây mẫu chuẩn Agile
  const baseEpics = [
    {
      id: 'epic-0',
      title: 'Quản lý Đặt xe & Ghép chuyến',
      description: 'Tiếp nhận yêu cầu đặt chuyến và ghép tài xế',
      stories: [
        {
          id: 'epic-0-story-0',
          parentId: 'epic-0',
          level: 2,
          type: 'Story',
          title: 'Khách hàng chọn điểm đón và điểm đến trên bản đồ',
          description: 'Ghim vị trí hoặc tìm kiếm địa chỉ',
          assigneeId: null,
          assigneeName: '',
          assigneeAvatar: '',
          tasks: [
            {
              id: 'epic-0-story-0-task-0',
              parentId: 'epic-0-story-0',
              level: 3,
              type: 'Task',
              title: 'Tích hợp Google Maps API',
              description: 'Lấy tọa độ vị trí hiện tại',
              assigneeId: null,
              assigneeName: '',
              assigneeAvatar: '',
            },
            {
              id: 'epic-0-story-0-task-1',
              parentId: 'epic-0-story-0',
              level: 3,
              type: 'Task',
              title: 'Thuật toán tính quãng đường và ước lượng cước phí',
              description: 'Nhân cước phí theo khung giờ',
              assigneeId: null,
              assigneeName: '',
              assigneeAvatar: '',
            },
          ],
        },
      ],
    },
    {
      id: 'epic-1',
      title: 'Thanh toán & Đánh giá Dịch vụ',
      description: 'Quản lý thanh toán và phản hồi chuyến đi',
      stories: [],
    },
  ];

  try {
    // -------------------------------------------------------------------------
    // Test 1: Nhánh ADD Story
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 1: Kiểm thử nhánh Thêm User Story (ADD STORY) ---');
    const addStoryResult = await mutateStoryTask('ADD', 'STORY', baseEpics, {
      epicId: 'epic-0',
      data: { title: 'Tài xế xem lộ trình di chuyển' },
    });

    testAssert(addStoryResult.success === true, 'Thao tác ADD Story trả về success = true');
    const epic0Stories = addStoryResult.epics[0].stories;
    testAssert(epic0Stories.length === 2, 'Epic #1 có 2 stories sau khi thêm');
    const addedStory = epic0Stories[1];
    testAssert(
      addedStory.title === 'Tài xế xem lộ trình di chuyển' && Array.isArray(addedStory.tasks) && addedStory.tasks.length === 0,
      'Story mới có tiêu đề chính xác và khởi tạo mảng tasks rỗng'
    );
    testAssert(
      addStoryResult.kpiMetrics.totalStories === 2,
      `Chỉ số KPI totalStories được tính lại chính xác (${addStoryResult.kpiMetrics.totalStories})`
    );

    // -------------------------------------------------------------------------
    // Test 2: Nhánh ADD Task
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Kiểm thử nhánh Thêm Task (ADD TASK) ---');
    const addTaskResult = await mutateStoryTask('ADD', 'TASK', addStoryResult.epics, {
      epicId: 'epic-0',
      storyId: 'epic-0-story-0',
      data: { title: 'Tối ưu hóa bộ nhớ đệm vị trí GPS' },
    });

    testAssert(addTaskResult.success === true, 'Thao tác ADD Task trả về success = true');
    const story0Tasks = addTaskResult.epics[0].stories[0].tasks;
    testAssert(story0Tasks.length === 3, 'Story #1 có 3 tasks sau khi thêm');
    const addedTask = story0Tasks[2];
    testAssert(
      addedTask.title === 'Tối ưu hóa bộ nhớ đệm vị trí GPS' && addedTask.parentId === 'epic-0-story-0',
      'Task mới có tiêu đề và parentId chính xác'
    );
    testAssert(
      addTaskResult.kpiMetrics.totalTasks === 3,
      `Chỉ số KPI totalTasks tăng lên chính xác (${addTaskResult.kpiMetrics.totalTasks})`
    );

    // -------------------------------------------------------------------------
    // Test 3: Nhánh UPDATE Story (Bảo toàn 100% tasks con)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Kiểm thử nhánh Sửa User Story (UPDATE STORY) ---');
    const updateStoryResult = await mutateStoryTask('UPDATE', 'STORY', addTaskResult.epics, {
      storyId: 'epic-0-story-0',
      data: {
        title: 'Khách hàng chọn điểm đón, điểm đến và phương thức thanh toán',
        assigneeId: 'qm:test-account-123',
        assigneeName: 'Nguyen Van Dev',
      },
    });

    testAssert(updateStoryResult.success === true, 'Thao tác UPDATE Story trả về success = true');
    const updatedStory = updateStoryResult.epics[0].stories[0];
    testAssert(
      updatedStory.title.includes('phương thức thanh toán') && updatedStory.assigneeName === 'Nguyen Van Dev',
      'Tiêu đề và thông tin Assignee của Story được cập nhật'
    );
    testAssert(
      Array.isArray(updatedStory.tasks) && updatedStory.tasks.length === 3,
      'BẢO TOÀN 100% mảng tasks con của Story, không bị reset hoặc mất dữ liệu'
    );

    // -------------------------------------------------------------------------
    // Test 4: Nhánh UPDATE Task
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Kiểm thử nhánh Sửa Task (UPDATE TASK) ---');
    const updateTaskResult = await mutateStoryTask('UPDATE', 'TASK', updateStoryResult.epics, {
      taskId: 'epic-0-story-0-task-0',
      data: {
        title: 'Tích hợp Google Maps SDK v3 & GPS định vị chính xác',
        description: 'Tối ưu hóa độ trễ phản hồi vị trí < 100ms',
      },
    });

    testAssert(updateTaskResult.success === true, 'Thao tác UPDATE Task trả về success = true');
    const updatedTask = updateTaskResult.epics[0].stories[0].tasks[0];
    testAssert(
      updatedTask.title === 'Tích hợp Google Maps SDK v3 & GPS định vị chính xác' &&
        updatedTask.description.includes('< 100ms'),
      'Task được cập nhật tiêu đề và mô tả chi tiết'
    );

    // -------------------------------------------------------------------------
    // Test 5: Nhánh DELETE Task
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Kiểm thử nhánh Xóa Task (DELETE TASK) ---');
    const deleteTaskResult = await mutateStoryTask('DELETE', 'TASK', updateTaskResult.epics, {
      taskId: 'epic-0-story-0-task-1',
    });

    testAssert(deleteTaskResult.success === true, 'Thao tác DELETE Task trả về success = true');
    const tasksAfterDelete = deleteTaskResult.epics[0].stories[0].tasks;
    testAssert(tasksAfterDelete.length === 2, 'Số lượng tasks giảm từ 3 xuống 2');
    testAssert(
      !tasksAfterDelete.some((t) => t.id === 'epic-0-story-0-task-1'),
      'Task mục tiêu đã bị lọc bỏ hoàn toàn khỏi mảng tasks'
    );
    testAssert(
      deleteTaskResult.kpiMetrics.totalTasks === 2,
      `Chỉ số KPI totalTasks giảm tương ứng (${deleteTaskResult.kpiMetrics.totalTasks})`
    );

    // -------------------------------------------------------------------------
    // Test 6: Nhánh DELETE Story
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Kiểm thử nhánh Xóa User Story (DELETE STORY) ---');
    const deleteStoryResult = await mutateStoryTask('DELETE', 'STORY', deleteTaskResult.epics, {
      storyId: 'epic-0-story-0',
    });

    testAssert(deleteStoryResult.success === true, 'Thao tác DELETE Story trả về success = true');
    const storiesAfterDelete = deleteStoryResult.epics[0].stories;
    testAssert(storiesAfterDelete.length === 1, 'Story mục tiêu và các task con bị xóa hoàn toàn khỏi Epic');
    testAssert(
      !storiesAfterDelete.some((s) => s.id === 'epic-0-story-0'),
      'Không còn vết tích của Story cũ trong cây, không để lại task mồ côi'
    );

    // -------------------------------------------------------------------------
    // Test 7: Kiểm tra xử lý lỗi Schema không hợp lệ (HTTP 400)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Kiểm tra bẫy lỗi Schema không hợp lệ ---');
    let schemaErrorCaught = false;
    try {
      await mutateStoryTask('UNKNOWN_ACTION', 'STORY', baseEpics, {});
    } catch (err) {
      schemaErrorCaught = true;
      testAssert(
        err.statusCode === 400 || err.message.includes('không hợp lệ'),
        `Bẫy lỗi thành công khi action sai: ${err.message}`
      );
    }
    testAssert(schemaErrorCaught, 'Từ chối request khi action không nằm trong danh mục ADD, UPDATE, DELETE');

    // -------------------------------------------------------------------------
    // Test 8: Kiểm tra xử lý lỗi Target ID không tồn tại trong cây (HTTP 400)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: Kiểm tra bẫy lỗi ID mục tiêu không tồn tại ---');
    let notFoundErrorCaught = false;
    try {
      await mutateStoryTask('UPDATE', 'STORY', baseEpics, {
        storyId: 'non-existent-story-id',
        data: { title: 'Test Sửa' },
      });
    } catch (err) {
      notFoundErrorCaught = true;
      testAssert(
        err.statusCode === 400 || err.message.includes('Không tìm thấy'),
        `Bẫy lỗi thành công khi ID không tồn tại: ${err.message}`
      );
    }
    testAssert(notFoundErrorCaught, 'Từ chối request khi Story ID không có trong cây yêu cầu');

    // -------------------------------------------------------------------------
    // Test 9: Kiểm tra Local Mutation Fallback Engine khi n8n Offline
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 9: Kiểm thử Local Mutation Fallback Engine ---');
    const fallbackResult = getLocalMutationFallback('ADD', 'STORY', baseEpics, {
      epicId: 'epic-1',
      data: { title: 'Khách hàng đánh giá sao và gửi nhận xét' },
    });

    testAssert(fallbackResult.success === true, 'Local Fallback Engine phản hồi success = true');
    testAssert(fallbackResult.metadata.flow6Fallback === true, 'Metadata ghi nhận cờ flow6Fallback = true');
    testAssert(
      fallbackResult.epics[1].stories.length === 1 &&
        fallbackResult.epics[1].stories[0].title === 'Khách hàng đánh giá sao và gửi nhận xét',
      'Local Fallback thêm Story chính xác vào Epic #2'
    );
    testAssert(
      fallbackResult.uiConfig && typeof fallbackResult.uiConfig.expandedNodesMap === 'object',
      'Local Fallback tạo UI expansion map đầy đủ cho giao diện'
    );
  } catch (error) {
    console.error('💥 Lỗi không mong đợi trong quá trình chạy test:', error);
  }

  console.log('\n================================================================');
  console.log(`🏁 KẾT QUẢ KIỂM THỬ FLOW 6: ${passedTests}/${totalTests} BÀI KIỂM TRA ĐẠT (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 TOÀN BỘ 9 TEST GROUPS CỦA FLOW 6 ĐÃ ĐẠT CHUẨN THÀNH CÔNG!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Có bài kiểm thử thất bại. Vui lòng kiểm tra lại mã nguồn.\n');
    process.exit(1);
  }
}

runTests();

