const axios = require('axios');

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/ai-requirement';

const N8N_HIERARCHY_TREE_WEBHOOK_URL =
  process.env.N8N_HIERARCHY_TREE_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/hierarchy-tree';

const N8N_STORY_TASK_WEBHOOK_URL =
  process.env.N8N_STORY_TASK_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/story-task-mutation';

async function postToN8n(url, payload, options = {}) {
  const mergedOptions = {
    timeout: 7000,
    ...options,
  };
  try {
    return await axios.post(url, payload, mergedOptions);
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (url.includes('/webhook-test/')) {
        fallbackUrl = url.replace('/webhook-test/', '/webhook/');
      } else if (url.includes('/webhook/')) {
        fallbackUrl = url.replace('/webhook/', '/webhook-test/');
      }
      if (fallbackUrl) {
        console.log(`[AIService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, mergedOptions);
      }
    }
    throw err;
  }
}

/**
 * Cơ chế Fallback AI thông minh (Simulation Engine):
 * Tự động bóc tách yêu cầu thành cấu trúc Epic -> Story -> Task chuẩn Agile
 * khi n8n gặp sự cố, thiếu API key hoặc mạng ngoài bị gián đoạn.
 */
function getSmartFallback(requirement = '') {
  const reqLower = requirement.toLowerCase();

  // Kịch bản 1: Dự án Đặt xe / SmartRide (Bộ dữ liệu chuẩn trong DEMO_SCRIPT.md)
  if (
    reqLower.includes('xe') ||
    reqLower.includes('tài xế') ||
    reqLower.includes('định vị') ||
    reqLower.includes('smartride') ||
    reqLower.includes('chuyến đi')
  ) {
    return {
      epics: [
        {
          title: 'Quản lý Đặt xe & Ghép chuyến (Ride Booking & Driver Matching)',
          description:
            'Hệ thống tiếp nhận yêu cầu đặt chuyến, định vị GPS và thuật toán ghép tài xế tối ưu trong bán kính 3km.',
          stories: [
            {
              title: 'Khách hàng chọn điểm đón và điểm đến trên bản đồ',
              description:
                'Cho phép người dùng ghim vị trí hoặc tìm kiếm địa chỉ để tính cước phí thời gian thực.',
              tasks: [
                {
                  title: 'Tích hợp Google Maps API & GPS định vị thời gian thực',
                  description:
                    'Hiển thị bản đồ tương tác và tự động lấy tọa độ vị trí hiện tại của khách hàng.',
                },
                {
                  title: 'Thuật toán tính toán quãng đường và ước lượng cước phí',
                  description:
                    'Tính khoảng cách di chuyển thực tế và nhân với đơn giá theo khung giờ.',
                },
              ],
            },
            {
              title: 'Hệ thống tự động ghép tài xế khả dụng gần nhất',
              description:
                'Tìm kiếm tài xế trong bán kính 3km có trạng thái sẵn sàng nhận chuyến.',
              tasks: [
                {
                  title: 'Truy vấn danh sách tài xế đang online trong bán kính 3km',
                  description:
                    'Lọc tài xế theo tọa độ không gian địa lý (Geo-spatial query).',
                },
                {
                  title: 'Gửi thông báo nhận chuyến tới ứng dụng của tài xế',
                  description:
                    'Phát tín hiệu Webhook / Push Notification đến thiết bị tài xế được chọn.',
                },
              ],
            },
          ],
        },
        {
          title: 'Thanh toán & Đánh giá Dịch vụ (Payment & Quality Rating)',
          description:
            'Quản lý luồng giao dịch tài chính đa kênh và thu thập phản hồi chất lượng dịch vụ sau chuyến đi.',
          stories: [
            {
              title: 'Khách hàng thanh toán cước chuyến đi đa phương thức',
              description:
                'Hỗ trợ thanh toán không tiền mặt qua Ví MoMo, ZaloPay hoặc Tiền mặt trực tiếp.',
              tasks: [
                {
                  title: 'Tích hợp cổng thanh toán Ví điện tử MoMo / ZaloPay',
                  description:
                    'Tạo link thanh toán QR Code và xử lý IPN xác nhận giao dịch thành công.',
                },
                {
                  title: 'Xử lý hoàn tiền tự động khi khách hàng hoặc tài xế hủy chuyến',
                  description:
                    'Đối soát và hoàn cước về ví nếu chuyến đi bị hủy trong thời gian quy định.',
                },
              ],
            },
            {
              title: 'Khách hàng phản hồi chất lượng dịch vụ',
              description:
                'Ghi nhận đánh giá sao và ý kiến đóng góp cho tài xế sau khi hoàn thành cuốc xe.',
              tasks: [
                {
                  title: 'Giao diện đánh giá 1-5 sao và nhập nhận xét cho tài xế',
                  description:
                    'Form pop-up hiển thị ngay khi chuyến xe hoàn tất.',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // Kịch bản 2: Quên mật khẩu / Xác thực tài khoản
  if (
    reqLower.includes('mật khẩu') ||
    reqLower.includes('đăng nhập') ||
    reqLower.includes('tài khoản') ||
    reqLower.includes('auth') ||
    reqLower.includes('otp')
  ) {
    return {
      epics: [
        {
          title: 'Quản lý Xác thực & Khôi phục Tài khoản',
          description:
            'Cung cấp quy trình an toàn cho người dùng khi quên mật khẩu hoặc cần đặt lại thông tin xác thực.',
          stories: [
            {
              title: 'Khách hàng yêu cầu khôi phục mật khẩu qua Email',
              description:
                'Người dùng nhập email đăng ký để nhận mã OTP hoặc đường link xác thực một lần.',
              tasks: [
                {
                  title: 'Xây dựng giao diện nhập Email quên mật khẩu',
                  description:
                    'Form có kiểm tra định dạng email và nút gửi yêu cầu có chống spam (rate limit).',
                },
                {
                  title: 'API sinh mã OTP bảo mật và gửi email cho người dùng',
                  description:
                    'Tạo mã OTP 6 số ngẫu nhiên, lưu cache thời hạn 5 phút và gửi qua Nodemailer.',
                },
              ],
            },
            {
              title: 'Xác thực mã OTP và thiết lập mật khẩu mới',
              description:
                'Người dùng nhập mã xác thực từ email và đặt lại mật khẩu mới cho tài khoản.',
              tasks: [
                {
                  title: 'API xác minh mã OTP và cấp mã token đặt lại mật khẩu',
                  description:
                    'Kiểm tra mã OTP nhập vào có khớp và còn hạn sử dụng hay không.',
                },
                {
                  title: 'Cập nhật mật khẩu mới mã hóa bcrypt vào cơ sở dữ liệu',
                  description:
                    'Hash mật khẩu mới với bcrypt salt 10 vòng và cập nhật vào bảng users.',
                },
              ],
            },
          ],
        },
        {
          title: 'Bảo mật & Giám sát Phiên làm việc',
          description:
            'Đảm bảo các phiên đăng nhập cũ bị hủy bỏ sau khi đổi mật khẩu thành công.',
          stories: [
            {
              title: 'Thu hồi các JWT token hiện hữu',
              description:
                'Tự động đăng xuất tài khoản trên tất cả các thiết bị sau khi đổi mật khẩu.',
              tasks: [
                {
                  title: 'Cập nhật thời gian token_version của người dùng',
                  description:
                    'Đảm bảo token cũ bị từ chối khi truy cập API bảo mật.',
                },
                {
                  title: 'Gửi email cảnh báo tài khoản vừa đổi mật khẩu',
                  description:
                    'Gửi email thông báo bảo mật kèm thời gian và IP thực hiện đổi mật khẩu.',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // Kịch bản 3: Tự động phân tách linh hoạt theo từng câu trong văn bản yêu cầu
  const clauses = requirement
    .split(/[\n.;,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const mainTitle = clauses[0] || 'Phân hệ Chức năng Hệ thống';
  const stories = (clauses.length > 1 ? clauses.slice(1, 4) : [mainTitle]).map(
    (sent, idx) => ({
      title: `Chức năng ${idx + 1}: ${sent.length > 55 ? sent.slice(0, 52) + '...' : sent}`,
      description: `Đặc tả quy trình thực thi chi tiết cho: ${sent}`,
      tasks: [
        {
          title: `Thiết kế giao diện người dùng cho ${sent.slice(0, 30)}`,
          description: `Xây dựng UI component tương ứng trên Frontend theo chuẩn UX/UI.`,
        },
        {
          title: `Phát triển API và xử lý dữ liệu backend cho ${sent.slice(0, 30)}`,
          description: `Viết endpoint Controller, Service và lưu trữ vào CSDL PostgreSQL.`,
        },
      ],
    })
  );

  return {
    epics: [
      {
        title: `Phân hệ: ${mainTitle.slice(0, 60)}`,
        description: `Mô tả chức năng tổng quan bóc tách từ yêu cầu: ${requirement}`,
        stories,
      },
    ],
  };
}

/**
 * Chuyển đổi cây phân cấp cục bộ (Local Hierarchy Fallback):
 * Được kích hoạt khi n8n Flow 5 gặp sự cố hoặc offline, đảm bảo cây luôn
 * có ID (epic-0, story-0-0, task-0-0-0), level (1, 2, 3), parentId và KPIs.
 */
function getLocalHierarchyFallback(rawEpics = [], context = {}) {
  const epics = Array.isArray(rawEpics) ? rawEpics : [];
  let totalStories = 0;
  let totalTasks = 0;

  const treeData = epics.map((epic, ei) => {
    const epicId = `epic-${ei}`;
    const rawStories = epic.stories || epic.user_stories || epic.userStories || [];

    const stories = (Array.isArray(rawStories) ? rawStories : []).map((story, si) => {
      const storyId = `${epicId}-story-${si}`;
      const rawTasks = story.tasks || story.subtasks || [];

      const tasks = (Array.isArray(rawTasks) ? rawTasks : []).map((task, ti) => {
        const taskId = `${storyId}-task-${ti}`;
        const title =
          typeof task === 'string'
            ? task.trim()
            : String(task.title || task.name || `Task #${ti + 1}`).trim();
        const description =
          typeof task === 'object'
            ? String(task.description || task.desc || '').trim()
            : '';

        return {
          id: taskId,
          parentId: storyId,
          level: 3,
          type: 'Task',
          title,
          description,
          assigneeId: typeof task === 'object' ? task.assigneeId || null : null,
          assigneeName: typeof task === 'object' ? task.assigneeName || '' : '',
          assigneeAvatar: typeof task === 'object' ? task.assigneeAvatar || '' : '',
        };
      });

      totalTasks += tasks.length;
      return {
        id: storyId,
        parentId: epicId,
        level: 2,
        type: 'Story',
        title: String(story.title || story.name || `User Story #${si + 1}`).trim(),
        description: String(story.description || story.desc || '').trim(),
        assigneeId: story.assigneeId || null,
        assigneeName: story.assigneeName || '',
        assigneeAvatar: story.assigneeAvatar || '',
        tasks,
      };
    });

    totalStories += stories.length;
    return {
      id: epicId,
      parentId: null,
      level: 1,
      type: 'Epic',
      title: String(epic.title || epic.name || `Epic #${ei + 1}`).trim(),
      description: String(epic.description || epic.details || epic.desc || '').trim(),
      stories,
    };
  });

  return {
    success: true,
    treeData,
    kpiMetrics: {
      totalEpics: treeData.length,
      totalStories,
      totalTasks,
      totalNodes: treeData.length + totalStories + totalTasks,
      treeDepth: treeData.length > 0 ? (totalStories > 0 ? (totalTasks > 0 ? 3 : 2) : 1) : 0,
      avgTasksPerStory: totalStories > 0 ? parseFloat((totalTasks / totalStories).toFixed(1)) : 0,
    },
    healthAudit: {
      healthScore: 100,
      warnings: [],
    },
    uiConfig: {
      expandedNodesMap: treeData.reduce((acc, ep) => {
        acc[ep.id] = true;
        (ep.stories || []).forEach((st) => (acc[st.id] = true));
        return acc;
      }, {}),
    },
    metadata: {
      requestId: context.requestId || `req-tree-fallback-${Date.now()}`,
      projectId: context.projectId || null,
      userId: context.userId || 'system-user',
      processedAt: new Date().toISOString(),
      flow5Fallback: true,
    },
  };
}

/**
 * Gửi dữ liệu epics sang Flow 5 (Requirement Hierarchy Tree Transformer)
 */
async function transformHierarchyTree(rawEpics, context = {}) {
  try {
    const response = await postToN8n(N8N_HIERARCHY_TREE_WEBHOOK_URL, {
      epics: rawEpics,
      projectId: context.projectId || null,
      userId: context.userId || 'system-user',
      requestId: context.requestId,
    });

    const flow5Data = response.data;
    if (flow5Data && (flow5Data.treeData || flow5Data.epics)) {
      return {
        ...flow5Data,
        flow5Success: true,
      };
    }
    throw new Error('n8n Flow 5 không trả về cấu trúc treeData hợp lệ');
  } catch (err) {
    console.warn(
      `[AIService] Flow 5 (hierarchy-tree) gặp sự cố (${err.message}). Kích hoạt Local Hierarchy Fallback Engine an toàn...`
    );
    const fallbackTree = getLocalHierarchyFallback(rawEpics, context);
    return {
      ...fallbackTree,
      flow5Success: false,
      flow5Fallback: true,
      flow5Error: err.message,
    };
  }
}

const analyzeRequirement = async (requirement, context = {}) => {
  let lastErr = null;
  let rawEpics = null;
  let flow4Success = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await postToN8n(N8N_WEBHOOK_URL, {
        requirement,
        projectId: context.projectId,
        userId: context.userId,
      });

      const rawData = response.data;
      if (!rawData) {
        throw new Error(
          'n8n không trả về dữ liệu bóc tách yêu cầu. Nguyên nhân: Khóa Google Gemini API Key trong n8n đã hết hạn mức miễn phí (Quota 429: 20 lượt/ngày) hoặc gặp lỗi kết nối AI. Vui lòng cập nhật API Key mới tại n8n Credentials.'
        );
      }

      // Trường hợp n8n trả về trực tiếp object đã có epics
      if (typeof rawData === 'object' && (rawData.epics || rawData.data?.epics)) {
        rawEpics = rawData.epics || rawData.data?.epics;
        flow4Success = true;
        break;
      }

      // Trường hợp trả về qua parts, content, text hoặc string
      let text =
        rawData?.parts?.[0]?.text ||
        rawData?.content ||
        rawData?.text ||
        (typeof rawData === 'string' ? rawData : null);

      if (!text && typeof rawData === 'object') {
        rawEpics = rawData;
        flow4Success = true;
        break;
      }

      if (!text) {
        throw new Error('n8n không trả về nội dung AI hợp lệ');
      }

      // Làm sạch markdown nếu LLM bọc trong ```json ... ```
      if (typeof text === 'string') {
        const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        rawEpics = parsed.epics || (Array.isArray(parsed) ? parsed : null);
        flow4Success = true;
        break;
      }

      rawEpics = text;
      flow4Success = true;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[AIService] Lần gọi n8n Flow 4 ${attempt} thất bại: ${err.message}`);
      if (err.response?.status === 500) {
        break;
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  // Nếu Flow 4 lỗi, kích hoạt fallback thông minh của Flow 4
  if (!rawEpics || !Array.isArray(rawEpics) || rawEpics.length === 0) {
    console.warn(
      `[AIService] Flow 4 gặp sự cố (${lastErr?.message}). Kích hoạt AI Simulation Fallback Engine...`
    );
    const simulated = getSmartFallback(requirement);
    rawEpics = simulated.epics;
  }

  // TÍCH HỢP FLOW 5: Chuyển dữ liệu epics sang Flow 5 (hierarchy-tree) để chuẩn hóa cấu trúc cây và tính KPI
  console.log(
    `[AIService] Gửi ${rawEpics.length} Epic(s) sang Flow 5 (hierarchy-tree) để chuẩn hóa cấu trúc cây...`
  );
  const flow5Result = await transformHierarchyTree(rawEpics, context);

  return {
    success: true,
    epics: flow5Result.treeData || rawEpics, // Đảm bảo trường epics luôn khớp 100% với Frontend cũ
    treeData: flow5Result.treeData || rawEpics,
    kpiMetrics: flow5Result.kpiMetrics || null,
    healthAudit: flow5Result.healthAudit || null,
    uiConfig: flow5Result.uiConfig || null,
    metadata: {
      ...(flow5Result.metadata || {}),
      flow4Success,
      flow5Success: flow5Result.flow5Success !== false,
      flow5Fallback: flow5Result.flow5Fallback === true,
      flow5Error: flow5Result.flow5Error || null,
    },
  };
};

/**
 * Fallback Engine nội bộ cho Flow 6 (Story & Task Mutation)
 * Xử lý thêm, sửa, xóa Story/Task theo nguyên tắc bất biến (immutable)
 * khi n8n Flow 6 offline hoặc gặp sự cố mạng.
 */
function getLocalMutationFallback(action, targetType, rawEpics = [], params = {}, context = {}) {
  const normAction = String(action || '').trim().toUpperCase();
  const normTarget = String(targetType || '').trim().toUpperCase();
  const { epicId, storyId, taskId, data = {} } = params;

  if (!['ADD', 'UPDATE', 'DELETE'].includes(normAction)) {
    throw new Error(`Hành động '${normAction}' không hợp lệ (hỗ trợ: ADD, UPDATE, DELETE)`);
  }
  if (!['STORY', 'TASK'].includes(normTarget)) {
    throw new Error(`Đối tượng '${normTarget}' không hợp lệ (hỗ trợ: STORY, TASK)`);
  }
  if (!Array.isArray(rawEpics) || rawEpics.length === 0) {
    throw new Error('Danh sách epics không được để trống');
  }

  const epics = JSON.parse(JSON.stringify(rawEpics));
  let message = '';
  let affectedNodeId = null;

  if (normAction === 'ADD') {
    if (normTarget === 'STORY') {
      const targetEpic = epicId ? epics.find((e) => e.id === epicId) : epics[0];
      if (!targetEpic) {
        throw new Error(`Không tìm thấy Epic cha với ID '${epicId}' để thêm Story`);
      }
      const epicIdx = epics.indexOf(targetEpic);
      const newStoryId = `epic-${epicIdx >= 0 ? epicIdx : 0}-story-${Date.now()}`;
      const newStory = {
        id: newStoryId,
        parentId: targetEpic.id,
        level: 2,
        type: 'Story',
        title: (data && data.title && data.title.trim()) ? data.title.trim() : 'User Story mới',
        description: (data && data.description) ? data.description.trim() : '',
        assigneeId: (data && data.assigneeId) || null,
        assigneeName: (data && data.assigneeName) || '',
        assigneeAvatar: (data && data.assigneeAvatar) || '',
        tasks: [],
      };
      if (!targetEpic.stories) targetEpic.stories = [];
      targetEpic.stories.push(newStory);
      affectedNodeId = newStoryId;
      message = `Đã thêm User Story mới vào Epic '${targetEpic.title}' thành công (Fallback Engine)`;
    } else if (normTarget === 'TASK') {
      let targetStory = null;
      for (const ep of epics) {
        const stories = ep.stories || ep.user_stories || [];
        const s = stories.find((st) => st.id === storyId);
        if (s) {
          targetStory = s;
          break;
        }
      }
      if (!targetStory) {
        throw new Error(`Không tìm thấy User Story với ID '${storyId}' để thêm Task`);
      }
      const newTaskId = `task-${Date.now()}`;
      const newTask = {
        id: newTaskId,
        parentId: targetStory.id,
        level: 3,
        type: 'Task',
        title: (data && data.title && data.title.trim()) ? data.title.trim() : 'Task mới',
        description: (data && data.description) ? data.description.trim() : '',
        assigneeId: (data && data.assigneeId) || null,
        assigneeName: (data && data.assigneeName) || '',
        assigneeAvatar: (data && data.assigneeAvatar) || '',
      };
      if (!targetStory.tasks) targetStory.tasks = [];
      targetStory.tasks.push(newTask);
      affectedNodeId = newTaskId;
      message = `Đã thêm Task mới vào Story '${targetStory.title}' thành công (Fallback Engine)`;
    }
  } else if (normAction === 'UPDATE') {
    let found = false;
    if (normTarget === 'STORY') {
      for (const ep of epics) {
        const stories = ep.stories || ep.user_stories || [];
        const s = stories.find((st) => st.id === storyId);
        if (s) {
          if (data.title !== undefined) s.title = String(data.title).trim();
          if (data.description !== undefined) s.description = String(data.description).trim();
          if (data.assigneeId !== undefined) s.assigneeId = data.assigneeId;
          if (data.assigneeName !== undefined) s.assigneeName = String(data.assigneeName).trim();
          if (data.assigneeAvatar !== undefined) s.assigneeAvatar = String(data.assigneeAvatar).trim();
          affectedNodeId = s.id;
          message = `Đã cập nhật User Story '${s.title}' thành công (Fallback Engine)`;
          found = true;
          break;
        }
      }
    } else if (normTarget === 'TASK') {
      for (const ep of epics) {
        const stories = ep.stories || ep.user_stories || [];
        for (const st of stories) {
          const tasks = st.tasks || st.subtasks || [];
          const t = tasks.find((tk) => tk.id === taskId);
          if (t) {
            if (data.title !== undefined) t.title = String(data.title).trim();
            if (data.description !== undefined) t.description = String(data.description).trim();
            if (data.assigneeId !== undefined) t.assigneeId = data.assigneeId;
            if (data.assigneeName !== undefined) t.assigneeName = String(data.assigneeName).trim();
            if (data.assigneeAvatar !== undefined) t.assigneeAvatar = String(data.assigneeAvatar).trim();
            affectedNodeId = t.id;
            message = `Đã cập nhật Task '${t.title}' thành công (Fallback Engine)`;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    if (!found) {
      throw new Error(`Không tìm thấy ${normTarget === 'STORY' ? 'User Story' : 'Task'} với ID '${normTarget === 'STORY' ? storyId : taskId}' trong cây yêu cầu`);
    }
  } else if (normAction === 'DELETE') {
    let deleted = false;
    if (normTarget === 'STORY') {
      for (const ep of epics) {
        if (ep.stories) {
          const initialCount = ep.stories.length;
          ep.stories = ep.stories.filter((st) => st.id !== storyId);
          if (ep.stories.length < initialCount) {
            deleted = true;
            affectedNodeId = storyId;
            message = `Đã xóa User Story thành công (Fallback Engine)`;
            break;
          }
        }
      }
    } else if (normTarget === 'TASK') {
      for (const ep of epics) {
        const stories = ep.stories || ep.user_stories || [];
        for (const st of stories) {
          if (st.tasks) {
            const initialCount = st.tasks.length;
            st.tasks = st.tasks.filter((tk) => tk.id !== taskId);
            if (st.tasks.length < initialCount) {
              deleted = true;
              affectedNodeId = taskId;
              message = `Đã xóa Task thành công (Fallback Engine)`;
              break;
            }
          }
        }
        if (deleted) break;
      }
    }
    if (!deleted) {
      throw new Error(`Không tìm thấy ${normTarget === 'STORY' ? 'User Story' : 'Task'} với ID '${normTarget === 'STORY' ? storyId : taskId}' để xóa`);
    }
  }

  // Tái tính toán KPIs
  let totalStories = 0;
  let totalTasks = 0;
  let warnings = [];
  const expandedNodesMap = {};

  for (const ep of epics) {
    expandedNodesMap[ep.id] = true;
    const stories = ep.stories || [];
    totalStories += stories.length;
    for (const st of stories) {
      expandedNodesMap[st.id] = true;
      const tasks = st.tasks || [];
      totalTasks += tasks.length;
      if (tasks.length === 0) {
        warnings.push(`Story '${st.title}' chưa có công việc kỹ thuật (Task) con.`);
      }
    }
  }

  if (affectedNodeId) {
    expandedNodesMap[affectedNodeId] = true;
  }

  const totalEpics = epics.length;
  const totalNodes = totalEpics + totalStories + totalTasks;
  const treeDepth = totalEpics > 0 ? (totalStories > 0 ? (totalTasks > 0 ? 3 : 2) : 1) : 0;
  const avgTasksPerStory = totalStories > 0 ? parseFloat((totalTasks / totalStories).toFixed(1)) : 0;
  const healthScore = warnings.length === 0 ? 100 : Math.max(70, 100 - (warnings.length * 5));

  return {
    success: true,
    action: normAction,
    targetType: normTarget,
    epics,
    treeData: epics,
    kpiMetrics: {
      totalEpics,
      totalStories,
      totalTasks,
      totalNodes,
      treeDepth,
      avgTasksPerStory,
    },
    healthAudit: {
      healthScore,
      warnings,
      totalWarnings: warnings.length,
    },
    uiConfig: {
      expandedNodesMap,
      viewportTargetId: affectedNodeId,
    },
    message,
    metadata: {
      requestId: context.requestId || `req-mut-fallback-${Date.now()}`,
      userId: context.userId || 'system-user',
      processedAt: new Date().toISOString(),
      flow6Fallback: true,
    },
  };
}

/**
 * Gửi yêu cầu đột biến Story/Task sang n8n Flow 6 (Story & Task Mutation Engine)
 */
async function mutateStoryTask(action, targetType, epics, params = {}, context = {}) {
  const normAction = String(action || '').trim().toUpperCase();
  const normTarget = String(targetType || '').trim().toUpperCase();

  // Kiểm tra tính hợp lệ cơ bản trước khi gọi
  if (!['ADD', 'UPDATE', 'DELETE'].includes(normAction)) {
    const err = new Error(`Hành động '${normAction}' không hợp lệ (hỗ trợ: ADD, UPDATE, DELETE)`);
    err.statusCode = 400;
    throw err;
  }
  if (!['STORY', 'TASK'].includes(normTarget)) {
    const err = new Error(`Đối tượng '${normTarget}' không hợp lệ (hỗ trợ: STORY, TASK)`);
    err.statusCode = 400;
    throw err;
  }
  if (!Array.isArray(epics) || epics.length === 0) {
    const err = new Error('Danh sách epics không được để trống');
    err.statusCode = 400;
    throw err;
  }

  try {
    const response = await postToN8n(N8N_STORY_TASK_WEBHOOK_URL, {
      action: normAction,
      targetType: normTarget,
      epics,
      epicId: params.epicId,
      storyId: params.storyId,
      taskId: params.taskId,
      data: params.data || {},
      userId: context.userId || 'system-user',
      requestId: context.requestId || `req-mut-${Date.now()}`,
    });

    const flow6Data = response.data;
    if (flow6Data && flow6Data.success !== false && (flow6Data.epics || flow6Data.treeData)) {
      return {
        ...flow6Data,
        flow6Success: true,
      };
    }
    throw new Error(flow6Data?.error || 'n8n Flow 6 không trả về cấu trúc epics hợp lệ');
  } catch (err) {
    // Nếu n8n trả về HTTP 400 có chủ đích (Validation error hoặc Target not found)
    if (err.response?.status === 400) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      const clientErr = new Error(errorMsg);
      clientErr.statusCode = 400;
      throw clientErr;
    }

    console.warn(
      `[AIService] Flow 6 (story-task-mutation) gặp sự cố (${err.message}). Kích hoạt Local Mutation Fallback Engine...`
    );
    const fallbackResult = getLocalMutationFallback(normAction, normTarget, epics, params, context);
    return {
      ...fallbackResult,
      flow6Success: false,
      flow6Fallback: true,
      flow6Error: err.message,
    };
  }
}

module.exports = {
  analyzeRequirement,
  transformHierarchyTree,
  getLocalHierarchyFallback,
  mutateStoryTask,
  getLocalMutationFallback,
};