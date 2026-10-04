const express = require('express');
const axios = require('axios');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// Hàm phân tích thông minh dự phòng khi offline hoặc test nhanh
function generateFallbackBreakdown(text, projectKey) {
  const pKey = projectKey || 'PROJ';
  return {
    epics: [
      {
        id: 'epic_' + Date.now(),
        summary: `Hệ thống tính năng: ${text.slice(0, 45)}...`,
        description: `Bóc tách toàn diện từ yêu cầu: "${text}"`,
        jiraKey: `${pKey}-${Math.floor(Math.random() * 800 + 100)}`,
        stories: [
          {
            id: 'story_' + Date.now() + '_1',
            summary: `Thiết kế API & Kiến trúc cơ sở dữ liệu cho yêu cầu`,
            description: `As a developer, I want to design clean database tables and RESTful endpoints so that data is securely processed.`,
            acceptanceCriteria: [
              'Tạo bảng dữ liệu với ràng buộc khóa ngoại',
              'Định nghĩa các DTO và mã phản hồi HTTP chuẩn',
              'Kiểm tra validation dữ liệu đầu vào'
            ],
            storyPoints: 5,
            priority: 'High',
            status: 'To Do',
            assignee: 'Backend Lead',
            tasks: [
              { id: 'task_' + Date.now() + '_1', summary: 'Viết migration schema & model', estimatedHours: 4, status: 'To Do' },
              { id: 'task_' + Date.now() + '_2', summary: 'Xây dựng controller & service logic', estimatedHours: 6, status: 'To Do' }
            ]
          },
          {
            id: 'story_' + Date.now() + '_2',
            summary: `Giao diện người dùng (UI/UX) và tương tác người dùng`,
            description: `As an end user, I want an intuitive and responsive interface so that I can easily interact with this feature.`,
            acceptanceCriteria: [
              'Giao diện responsive trên mobile và desktop',
              'Hiển thị trạng thái loading và thông báo lỗi rõ ràng'
            ],
            storyPoints: 3,
            priority: 'Medium',
            status: 'To Do',
            assignee: 'Frontend Dev',
            tasks: [
              { id: 'task_' + Date.now() + '_3', summary: 'Tạo component giao diện React', estimatedHours: 4, status: 'To Do' },
              { id: 'task_' + Date.now() + '_4', summary: 'Tích hợp gọi API từ Client', estimatedHours: 3, status: 'To Do' }
            ]
          },
          {
            id: 'story_' + Date.now() + '_3',
            summary: `Kiểm thử bảo mật, tích hợp và tối ưu hiệu năng`,
            description: `As a QA engineer, I want automated test suites so that no regression bugs reach production.`,
            acceptanceCriteria: [
              'Độ bao phủ Unit Test đạt ít nhất 80%',
              'Thời gian phản hồi API dưới 300ms'
            ],
            storyPoints: 2,
            priority: 'Low',
            status: 'To Do',
            assignee: 'QA Engineer',
            tasks: [
              { id: 'task_' + Date.now() + '_5', summary: 'Viết Integration & Unit Tests', estimatedHours: 3, status: 'To Do' }
            ]
          }
        ]
      }
    ]
  };
}

// 4. Gửi yêu cầu phân tích (Core - Thành viên 2)
// Gọi n8n Webhook, nếu n8n chưa chạy thì fallback trực tiếp sang Gemini API hoặc fallback generator
router.post('/analyze', verifyToken, async (req, res) => {
  const { workspaceId, requirementText, projectKey } = req.body;

  if (!requirementText || requirementText.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đoạn mô tả yêu cầu nghiệp vụ dài hơn' });
  }

  const db = readDB();
  const config = db.apiConfigs[workspaceId] || {};
  const n8nUrl = config.n8nWebhookUrl || 'http://localhost:5678/webhook/analyze-requirement';
  const geminiKey = config.geminiKey || process.env.GEMINI_API_KEY;
  const pKey = projectKey || 'PROJ';

  let breakdownData = null;
  let processingEngine = '';

  // BƯỚC 1: Thử gọi n8n Webhook trước (theo đúng yêu cầu đồ án)
  try {
    console.log(`[AI Analyze] Đang gọi Webhook n8n tại: ${n8nUrl}...`);
    const n8nResponse = await axios.post(n8nUrl, {
      requirementText,
      projectKey: pKey,
      geminiApiKey: geminiKey
    }, { timeout: 8000 });

    if (n8nResponse.data && (n8nResponse.data.data || n8nResponse.data.epics)) {
      breakdownData = n8nResponse.data.data || n8nResponse.data;
      processingEngine = 'n8n Webhook Engine';
    }
  } catch (n8nErr) {
    console.log(`[AI Analyze] n8n Webhook chưa mở hoặc không phản hồi (${n8nErr.message}). Đang chuyển sang Gemini Direct Engine...`);
  }

  // BƯỚC 2: Nếu n8n chưa mở, gọi trực tiếp Gemini API nếu có key
  if (!breakdownData && geminiKey) {
    try {
      const systemInstruction = `Bạn là Senior Business Analyst và Scrum Master.
Hãy phân tích yêu cầu sau thành Epic -> User Stories -> Sub-tasks.
BẮT BUỘC chỉ trả về JSON thuần túy (không kèm markdown):
{
  "epics": [
    {
      "summary": "Tên Epic",
      "description": "Mục tiêu",
      "stories": [
        {
          "summary": "Tên User Story",
          "description": "As a [role], I want [feature] so that [benefit]",
          "acceptanceCriteria": ["Tiêu chí 1", "Tiêu chí 2"],
          "storyPoints": 3,
          "priority": "High",
          "tasks": [
            { "summary": "Tên Task kỹ thuật", "type": "Sub-task", "estimatedHours": 4 }
          ]
        }
      ]
    }
  ]
}`;

      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nYÊU CẦU NGHIỆP VỤ:\n${requirementText}` }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        },
        { timeout: 15000 }
      );

      let textRes = geminiRes.data.candidates[0].content.parts[0].text;
      textRes = textRes.replace(/```json/gi, '').replace(/```/gi, '').trim();
      breakdownData = JSON.parse(textRes);
      processingEngine = 'Gemini 2.0 Flash Direct';
    } catch (geminiErr) {
      console.log(`[AI Analyze] Gemini API lỗi: ${geminiErr.message}. Dùng Fallback generator...`);
    }
  }

  // BƯỚC 3: Fallback Heuristic Generator nếu offline
  if (!breakdownData) {
    breakdownData = generateFallbackBreakdown(requirementText, pKey);
    processingEngine = 'Mock BA Engine (Offline Demo)';
  }

  // Đảm bảo ID định danh cho từng node
  if (breakdownData.epics) {
    breakdownData.epics.forEach((epic, eIdx) => {
      epic.id = epic.id || `epic_${Date.now()}_${eIdx}`;
      epic.jiraKey = epic.jiraKey || `${pKey}-${Math.floor(Math.random() * 800 + 100)}`;
      if (epic.stories) {
        epic.stories.forEach((st, sIdx) => {
          st.id = st.id || `story_${Date.now()}_${eIdx}_${sIdx}`;
          st.priority = st.priority || 'Medium';
          st.storyPoints = st.storyPoints || 3;
          st.status = st.status || 'To Do';
          if (st.tasks) {
            st.tasks.forEach((t, tIdx) => {
              t.id = t.id || `task_${Date.now()}_${eIdx}_${sIdx}_${tIdx}`;
              t.estimatedHours = t.estimatedHours || 3;
              t.status = t.status || 'To Do';
            });
          }
        });
      }
    });
  }

  // Lưu phiên phân tích vào Database
  const newSession = {
    id: 'req_' + Date.now(),
    workspaceId: workspaceId || 'ws_default',
    title: requirementText.slice(0, 60) + '...',
    rawText: requirementText,
    status: 'ANALYZED',
    processingEngine,
    createdAt: new Date().toISOString(),
    pushedToJira: false,
    epics: breakdownData.epics || []
  };

  db.requirements.unshift(newSession);
  writeDB(db);

  res.json({
    success: true,
    message: `Phân tích thành công bằng ${processingEngine}`,
    engine: processingEngine,
    session: newSession,
    data: breakdownData
  });
});

// Lấy danh sách các session/requirements đã phân tích của Workspace
router.get('/sessions/:workspaceId', verifyToken, (req, res) => {
  const { workspaceId } = req.params;
  const db = readDB();
  const list = db.requirements.filter(r => r.workspaceId === workspaceId);
  res.json({ success: true, sessions: list });
});

// 6. Chỉnh sửa kết quả (Human-in-the-loop: Edit/Validate - Thành viên 2)
router.put('/sessions/:sessionId', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const { epics, title } = req.body;

  const db = readDB();
  const session = db.requirements.find(r => r.id === sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiên làm việc' });
  }

  if (epics) session.epics = epics;
  if (title) session.title = title;
  session.updatedAt = new Date().toISOString();

  writeDB(db);
  res.json({ success: true, message: 'Đã lưu chỉnh sửa thành công', session });
});

// Tái tạo một User Story riêng biệt bằng AI
router.post('/regenerate-story', verifyToken, async (req, res) => {
  const { workspaceId, epicSummary, currentStorySummary } = req.body;
  const db = readDB();
  const config = db.apiConfigs[workspaceId] || {};
  const geminiKey = config.geminiKey || process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      const prompt = `Bạn là Scrum Master. Hãy viết lại User Story sau cho thật chuẩn Agile và chi tiết:
Epic: ${epicSummary}
Story hiện tại: ${currentStorySummary}

Chỉ trả về JSON theo mẫu:
{
  "summary": "Tên Story mới",
  "description": "As a [role], I want [feature] so that [benefit]",
  "acceptanceCriteria": ["Tiêu chí 1", "Tiêu chí 2"],
  "storyPoints": 5,
  "priority": "High"
}`;
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        },
        { timeout: 8000 }
      );
      let textRes = geminiRes.data.candidates[0].content.parts[0].text;
      textRes = textRes.replace(/```json/gi, '').replace(/```/gi, '').trim();
      return res.json({ success: true, story: JSON.parse(textRes) });
    } catch (e) {
      // Fallback
    }
  }

  // Fallback demo story
  res.json({
    success: true,
    story: {
      summary: `Tối ưu hóa: ${currentStorySummary}`,
      description: `As a user, I want an enhanced experience for ${currentStorySummary} so that I can achieve my goal effectively.`,
      acceptanceCriteria: ['Xử lý ngoại lệ chuẩn', 'Giao diện mượt mà, phản hồi ngay lập tức'],
      storyPoints: 5,
      priority: 'High'
    }
  });
});

module.exports = router;
