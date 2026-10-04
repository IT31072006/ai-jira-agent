const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Khởi tạo thư mục và dữ liệu ban đầu nếu chưa có
function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [
        {
          id: 'user_default',
          email: 'demo@jira-agent.ai',
          // hash của 'password123'
          passwordHash: '$2a$10$wK1kKkI5k82oG8aP8t1q2u0B9eM.qQYp8mXb/gI4M2rW5zYxKzO7C',
          fullName: 'Nguyễn Văn Quản Trị',
          createdAt: new Date().toISOString()
        }
      ],
      workspaces: [
        {
          id: 'ws_demo_ecommerce',
          userId: 'user_default',
          name: 'E-Commerce Platform 2026',
          description: 'Hệ thống thương mại điện tử tích hợp cổng thanh toán và quản lý đơn hàng',
          defaultJiraProjectKey: 'ECOM',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ws_demo_hrm',
          userId: 'user_default',
          name: 'Smart HRM System',
          description: 'Phần mềm quản lý nhân sự, chấm công và tính lương tự động',
          defaultJiraProjectKey: 'HRM',
          createdAt: new Date().toISOString()
        }
      ],
      apiConfigs: {
        ws_demo_ecommerce: {
          jiraDomain: 'mycompany.atlassian.net',
          jiraEmail: 'lead-dev@mycompany.com',
          jiraToken: '',
          geminiKey: '',
          discordWebhookUrl: '',
          n8nWebhookUrl: 'http://localhost:5678/webhook/analyze-requirement',
          n8nPushWebhookUrl: 'http://localhost:5678/webhook/push-to-jira'
        }
      },
      requirements: [
        {
          id: 'req_1',
          workspaceId: 'ws_demo_ecommerce',
          title: 'Tích hợp thanh toán qua VNPay & MoMo',
          rawText: 'Xây dựng module thanh toán cho khách hàng mua sắm online. Khách có thể chọn thanh toán qua VNPay QR hoặc Ví MoMo. Hệ thống cần bảo mật mã hóa chữ ký số (HMAC-SHA512), tự động cập nhật trạng thái đơn hàng khi nhận IPN webhook và gửi email xác nhận cho khách hàng.',
          status: 'ANALYZED',
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          pushedToJira: true,
          pushedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          epics: [
            {
              id: 'epic_1',
              summary: 'Cổng thanh toán điện tử VNPay & MoMo',
              description: 'Tích hợp toàn diện các phương thức thanh toán ví điện tử và ngân hàng',
              jiraKey: 'ECOM-101',
              stories: [
                {
                  id: 'story_1',
                  summary: 'Thanh toán đơn hàng qua VNPay QR',
                  description: 'As a customer, I want to scan VNPay QR code so that I can pay quickly from mobile banking.',
                  acceptanceCriteria: [
                    'Tạo mã QR code động theo số tiền đơn hàng',
                    'Thời gian hết hạn mã QR là 15 phút',
                    'Kiểm tra checksum chữ ký HMAC-SHA512 an toàn'
                  ],
                  storyPoints: 5,
                  priority: 'High',
                  assignee: 'Nguyễn Văn Developer',
                  jiraKey: 'ECOM-102',
                  status: 'In Progress',
                  tasks: [
                    { id: 'task_1_1', summary: 'Xây dựng API tạo URL thanh toán VNPay', estimatedHours: 4, jiraKey: 'ECOM-103', status: 'Done' },
                    { id: 'task_1_2', summary: 'Xây dựng Endpoint xử lý VNPay IPN Webhook', estimatedHours: 4, jiraKey: 'ECOM-104', status: 'In Progress' },
                    { id: 'task_1_3', summary: 'Giao diện quét mã QR trên React Frontend', estimatedHours: 3, jiraKey: 'ECOM-105', status: 'To Do' }
                  ]
                },
                {
                  id: 'story_2',
                  summary: 'Thanh toán đơn hàng qua Ví MoMo',
                  description: 'As a customer, I want to pay using MoMo wallet app so that I can utilize my MoMo balance.',
                  acceptanceCriteria: [
                    'Redirect sang ứng dụng MoMo trên điện thoại',
                    'Lưu mã giao dịch MoMo transId vào Database'
                  ],
                  storyPoints: 3,
                  priority: 'Medium',
                  assignee: 'Trần Thị QA',
                  jiraKey: 'ECOM-106',
                  status: 'To Do',
                  tasks: [
                    { id: 'task_2_1', summary: 'Tích hợp SDK MoMo Payment Gateway', estimatedHours: 3, jiraKey: 'ECOM-107', status: 'To Do' },
                    { id: 'task_2_2', summary: 'Viết Unit Test cho flow thanh toán thất bại/hết hạn', estimatedHours: 2, jiraKey: 'ECOM-108', status: 'To Do' }
                  ]
                }
              ]
            }
          ]
        }
      ],
      syncLogs: [
        {
          id: 'log_1',
          issueKey: 'ECOM-103',
          oldStatus: 'In Progress',
          newStatus: 'Done',
          event: 'jira:issue_updated',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      ]
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function readDB() {
  initStorage();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Lỗi đọc database file:', err);
    return { users: [], workspaces: [], apiConfigs: {}, requirements: [], syncLogs: [] };
  }
}

function writeDB(data) {
  initStorage();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  readDB,
  writeDB,
  initStorage
};
