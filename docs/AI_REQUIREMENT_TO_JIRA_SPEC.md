# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC & QUY TRÌNH N8N WORKFLOW
## DỰ ÁN: AI REQUIREMENT-TO-JIRA AGENT

> **Dành cho 4 thành viên nhóm phát triển.**  
> Tài liệu này chuẩn hóa toàn bộ 12 luồng tính năng, luồng giao tiếp giữa React <-> Express <-> n8n <-> Gemini / Jira, và sơ đồ trực quan từng Node trên n8n canvas.

---

## 1. TỔNG QUAN HỆ THỐNG & SƠ ĐỒ TỔNG THỂ

Hệ thống kết hợp giữa **Web Application** và **Workflow Automation (n8n)**:
- **Frontend (React)**: Nhập yêu cầu, xem trước cây dữ liệu, chỉnh sửa (Human-in-the-loop), theo dõi dashboard.
- **Backend (Express.js)**: Xác thực JWT, quản lý cơ sở dữ liệu, quản lý API Keys vault, chuyển tiếp request đến n8n Webhook.
- **n8n Automation Engine**: Xử lý logic gọi AI (Gemini), vòng lặp bóc tách tạo Jira (Epic -> Story -> Subtask), bắn webhook thông báo.
- **Dịch vụ ngoài**: Google Gemini 2.0 Flash API, Atlassian Jira Cloud REST API v3, Discord/Slack Webhook.

```mermaid
flowchart TB
    subgraph Client["Lớp Giao Diện (React + Tailwind/MUI)"]
        UI_Auth["Auth & Workspace UI"]
        UI_Editor["AI Tree/Table Editor (Human-in-the-loop)"]
        UI_Dashboard["Dashboard & Export"]
        UI_Config["API Key Vault Config"]
    end

    subgraph Backend["Lớp Backend (Express.js REST API)"]
        API_Auth["/api/auth (JWT)"]
        API_Workspace["/api/workspaces (CRUD)"]
        API_Keys["/api/keys (Encrypted Vault)"]
        API_AI["/api/ai/analyze"]
        API_Jira["/api/jira/push & /members"]
        API_Webhook["/api/webhooks/jira-sync"]
        API_Stats["/api/stats/dashboard"]
        DB[(Database: MySQL / MongoDB)]
    end

    subgraph N8N["Lớp Tự Động Hóa Workflow (n8n Automation Engine)"]
        WF1["Workflow 1: AI Requirement Parser\n(Webhook -> Gemini -> JSON Parser)"]
        WF2["Workflow 2: Jira Batch Hierarchy Creator\n(Webhook -> Loop Epic/Story/Task -> Jira API)"]
        WF3["Workflow 3: Jira Webhook Status Sync\n(Webhook -> Filter -> Update Express API)"]
        WF4["Workflow 4: Multi-channel Notification\n(Webhook -> Slack / Discord / Email)"]
    end

    subgraph External["Dịch Vụ Bên Ngoài"]
        Gemini["Google Gemini 2.0 Flash / Pro API"]
        Jira["Atlassian Jira Cloud REST API v3"]
        NotifyChannels["Slack / Discord Webhooks & SMTP"]
    end

    UI_Auth --> API_Auth
    UI_Config --> API_Keys
    UI_Dashboard --> API_Stats
    API_Auth & API_Workspace & API_Keys & API_Stats --> DB

    UI_Editor -- "1. Gửi raw text" --> API_AI
    API_AI -- "2. Trigger Webhook" --> WF1
    WF1 -- "3. Prompt + JSON Schema" --> Gemini
    Gemini -- "4. Trả JSON Epic/Story/Task" --> WF1
    WF1 -- "5. Respond Webhook" --> API_AI
    API_AI -- "6. Render Cây Dữ Liệu" --> UI_Editor

    UI_Editor -- "7. Duyệt & Gửi Jira payload" --> API_Jira
    API_Jira -- "8. Trigger Webhook" --> WF2
    WF2 -- "9. Loop tạo Epic -> Story -> Subtask" --> Jira
    WF2 -- "10. Kích hoạt thông báo" --> WF4
    WF4 --> NotifyChannels

    Jira -- "11. Webhook khi Task chuyển trạng thái" --> API_Webhook
    API_Webhook --> DB
```

---

## 2. PHÂN CHIA 12 LUỒNG CHO 4 THÀNH VIÊN

```mermaid
mindmap
  root((AI Requirement to Jira))
    ThanhVien1["Thành viên 1: Quản trị & Nền tảng"]
      L1["1. Đăng ký / Đăng nhập (JWT)"]
      L2["2. Quản lý Dự án (Workspace)"]
      L3["3. Cấu hình Vault API Keys"]
    ThanhVien2["Thành viên 2: Core AI & Giao diện"]
      L4["4. Gửi yêu cầu & n8n AI Webhook"]
      L5["5. Giao diện cây/bảng trực quan"]
      L6["6. Chỉnh sửa, duyệt (Human-in-the-loop)"]
    ThanhVien3["Thành viên 3: Tích hợp Jira"]
      L7["7. Đẩy dữ liệu Jira qua n8n Loop"]
      L8["8. Lấy danh sách Member Jira"]
      L9["9. Đồng bộ ngược Jira Webhook"]
    ThanhVien4["Thành viên 4: Báo cáo & Hậu mãi"]
      L10["10. Dashboard Thống kê & Biểu đồ"]
      L11["11. Thông báo Slack/Discord tự động"]
      L12["12. Xuất báo cáo PDF / Markdown"]
```

---

## 3. THIẾT KẾ CÁC SƠ ĐỒ WORKFLOW TRÊN N8N KÈM WEBHOOK

### WORKFLOW 1: BÓC TÁCH YÊU CẦU NGHIỆP VỤ BẰNG AI (LUỒNG 4 - THÀNH VIÊN 2)

**Mục tiêu**: Nhận đoạn text yêu cầu nghiệp vụ, gọi Gemini AI với prompt cấu trúc nghiêm ngặt, parse JSON và trả về cây Epic -> Story -> Sub-task.

#### Sơ đồ Canvas các Node trên n8n:
```mermaid
flowchart LR
    N1["[Webhook Node]\nPOST /webhook/analyze-requirement"]
    N2["[Code Node]\nPrepare Prompt & JSON Schema"]
    N3["[HTTP Request / Gemini Node]\nCall Google Gemini API"]
    N4["[Code Node]\nSanitize & Validate JSON"]
    N5["[Respond to Webhook Node]\nReturn Parsed Tree JSON"]

    N1 --> N2 --> N3 --> N4 --> N5
```

#### Chi tiết thiết lập từng Node trên n8n:
1. **Node 1: Webhook Trigger**:
   - HTTP Method: `POST`
   - Path: `analyze-requirement`
   - Response Mode: `Using 'Respond to Webhook' Node`
2. **Node 2: Code Node (Xây dựng Prompt)**:
   - Nhận payload từ Webhook: `{ requirementText, projectKey, geminiApiKey }`
   - Gắn prompt ép AI trả về schema:
     ```json
     {
       "epics": [
         {
           "summary": "Tên Epic",
           "description": "Mô tả",
           "stories": [
             {
               "summary": "Tên Story",
               "description": "As a... I want... So that...",
               "storyPoints": 3,
               "priority": "High",
               "tasks": [
                 { "summary": "Tên Sub-task", "estimatedHours": 4 }
               ]
             }
           ]
         }
       ]
     }
     ```
3. **Node 3: HTTP Request (Gemini API)**:
   - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={{$json.geminiApiKey}}`
   - Body: JSON prompt với `temperature: 0.2`, `responseMimeType: "application/json"`.
4. **Node 4: Code Node (Làm sạch & parse JSON)**:
   - Loại bỏ markdown backticks (nếu có), validate cú pháp JSON.
5. **Node 5: Respond to Webhook**:
   - HTTP Status 200, trả dữ liệu JSON về cho Express.

---

### WORKFLOW 2: TỰ ĐỘNG TẠO HIERARCHY TRÊN JIRA (LUỒNG 7 - THÀNH VIÊN 3)

**Mục tiêu**: Nhận cây dữ liệu Epic/Story/Sub-task đã được duyệt, dùng Loop node tạo lần lượt trên Jira Cloud và liên kết quan hệ cha-con chính xác.

#### Sơ đồ Canvas các Node trên n8n:
```mermaid
flowchart TD
    W2["[Webhook Node]\nPOST /webhook/push-to-jira"] --> Prep["[Code Node]\nChuẩn hóa danh sách Epics"]
    Prep --> LoopEpics{"[Loop Epics Node]\nSplitInBatches (size: 1)"}

    LoopEpics -- "Mỗi Epic" --> JiraEpic["[HTTP Request Node]\nJira API: Tạo Epic\n(POST /rest/api/3/issue)"]
    JiraEpic --> ExtractEpic["[Code Node]\nLưu epicKey & lấy Stories"]
    ExtractEpic --> LoopStories{"[Loop Stories Node]\nSplitInBatches (size: 1)"}

    LoopStories -- "Mỗi Story" --> JiraStory["[HTTP Request Node]\nJira API: Tạo Story gắn Epic\n(POST /rest/api/3/issue)"]
    JiraStory --> ExtractStory["[Code Node]\nLưu storyKey & lấy Tasks"]
    ExtractStory --> LoopTasks{"[Loop Tasks Node]\nSplitInBatches (size: 1)"}

    LoopTasks -- "Mỗi Sub-task" --> JiraTask["[HTTP Request Node]\nJira API: Tạo Sub-task gắn Story\n(POST /rest/api/3/issue)"]
    JiraTask --> LoopTasks

    LoopTasks -- "Xong Sub-tasks" --> LoopStories
    LoopStories -- "Xong Stories" --> LoopEpics
    LoopEpics -- "Hoàn tất toàn bộ" --> Summary["[Code Node]\nTổng hợp báo cáo ID/Keys"]
    Summary --> TriggerNotify["[HTTP Request Node]\nKích hoạt Notification Workflow"]
    TriggerNotify --> Resp["[Respond to Webhook Node]\nTrả kết quả thành công về Express"]
```

#### Chi tiết gọi Jira REST API v3:
- **Tạo Epic**: `POST https://{domain}/rest/api/3/issue` với `issuetype: { name: "Epic" }`. Nhận về `epicKey` (vd: `PROJ-101`).
- **Tạo Story**: `POST https://{domain}/rest/api/3/issue` với `issuetype: { name: "Story" }`, gắn `parent: { key: epicKey }`. Nhận về `storyKey`.
- **Tạo Sub-task**: `POST https://{domain}/rest/api/3/issue` với `issuetype: { name: "Sub-task" }`, gắn `parent: { key: storyKey }`.

---

### WORKFLOW 3: ĐỒNG BỘ TRẠNG THÁI NGƯỢC TỪ JIRA WEBHOOK (LUỒNG 9 - THÀNH VIÊN 3)

**Mục tiêu**: Lắng nghe sự kiện từ Jira khi Dev kéo task sang "Done", tự động đồng bộ vào Database của website.

#### Sơ đồ Canvas các Node trên n8n:
```mermaid
flowchart LR
    JiraHook["[Webhook Node]\nPOST /webhook/jira-event-sync"]
    Filter["[IF Node]\nKiểm tra status thay đổi?"]
    Parse["[Code Node]\nTrích xuất issueKey & status mới"]
    UpdateAPI["[HTTP Request Node]\nPUT Express: /api/internal/sync-task-status"]
    Ack["[Respond to Webhook Node]\nHTTP 200 OK"]

    JiraHook --> Filter
    Filter -- "Đúng sự kiện status" --> Parse --> UpdateAPI --> Ack
    Filter -- "Sự kiện khác" --> Ack
```

---

### WORKFLOW 4: THÔNG BÁO TỰ ĐỘNG ĐA KÊNH DISCORD / SLACK (LUỒNG 11 - THÀNH VIÊN 4)

**Mục tiêu**: Bắn thông báo đẹp mắt vào Discord và Slack khi một đợt tạo Epic/Task thành công.

#### Sơ đồ Canvas các Node trên n8n:
```mermaid
flowchart LR
    Start["[Webhook Node / Sub-workflow Trigger]\nNhận kết quả tạo Jira"]
    Format["[Code Node]\nTạo Rich Markdown & Block Kit"]

    Discord["[Discord Node / HTTP Request]\nBắn Rich Embed Card"]
    Slack["[Slack Node / HTTP Request]\nBắn Slack Block Kit Message"]
    Email["[Email / Gmail Node]\nGửi Email Digest tới PM & Team"]

    Done["[Respond to Webhook]\nTrả kết quả thông báo thành công"]

    Start --> Format
    Format --> Discord --> Done
    Format --> Slack --> Done
    Format --> Email --> Done
```

---

## 4. CHI TIẾT CÁC ENDPOINT API CỦA EXPRESS (BACKEND)

### Nhóm Auth & Workspace (Thành viên 1)
- `POST /api/auth/register`: Đăng ký tài khoản mới.
- `POST /api/auth/login`: Đăng nhập, trả về JWT Token.
- `GET /api/workspaces`: Lấy danh sách workspace người dùng sở hữu.
- `POST /api/workspaces`: Tạo workspace mới.
- `POST /api/keys/save`: Lưu và mã hóa Jira Domain, Token và Gemini Key.

### Nhóm AI Processing (Thành viên 2)
- `POST /api/ai/analyze`: Nhận yêu cầu thô từ React, lấy key từ DB và chuyển tiếp đến n8n Webhook `/webhook/analyze-requirement`.

### Nhóm Jira Integration (Thành viên 3)
- `POST /api/jira/push`: Nhận cấu trúc Story/Task sau khi người dùng chỉnh sửa, gọi n8n Webhook `/webhook/push-to-jira`.
- `GET /api/jira/members?project=PROJ`: Lấy danh sách thành viên trong project Jira để người dùng assign việc trực tiếp.
- `POST /api/webhooks/jira-sync`: Tiếp nhận webhook đồng bộ trạng thái ngược từ Jira.

### Nhóm Dashboard & Report (Thành viên 4)
- `GET /api/stats/dashboard`: Lấy các chỉ số thống kê (số Epic, số Story, tỷ lệ hoàn thành, thời gian xử lý AI).
- `GET /api/export/markdown/:sessionId`: Xuất file Markdown.
- `GET /api/export/pdf/:sessionId`: Xuất file PDF.

---

## 5. CHECKLIST TRIỂN KHAI CHO TỪNG THÀNH VIÊN

- [ ] **Thành viên 1**: Cài đặt JWT, thiết kế bảng User/Workspace/ApiConfig, viết API CRUD Workspace và Vault mã hóa API Key.
- [ ] **Thành viên 2**: Tạo giao diện React nhập yêu cầu, dựng Node n8n cho Flow 4 (Gemini), dựng giao diện Cây phân cấp (Tree/Table) với hiệu ứng Tailwind/MUI, chức năng Thêm/Sửa/Xóa inline.
- [ ] **Thành viên 3**: Dựng Node n8n cho Flow 7 (Vòng lặp tạo Epic -> Story -> Subtask trên Jira), viết API lấy member Jira, cấu hình webhook đồng bộ ngược (Flow 9).
- [ ] **Thành viên 4**: Dựng trang Dashboard hiển thị biểu đồ phân bố Story Points / Task count, thiết lập Node n8n Flow 11 (Discord / Slack notification), viết tính năng xuất PDF / Markdown (Flow 12).
