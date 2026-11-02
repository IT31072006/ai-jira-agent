# BÁO CÁO TRIỂN KHAI VÀ TỐI ƯU FLOW 13
## HỆ THỐNG AUTOMATION SCHEDULER & SPRINT HEALTH WATCHDOG (CHÍNH XÁC 14 NODES TRỰC QUAN N8N)

---

## I. TỔNG QUAN ĐỀ TÀI & Ý NGHĨA CHO MÔN HỌC AUTOMATION

- **Đồ án:** AI Jira Agent — Hệ thống Tự động Phân rã Yêu cầu và Quản lý Tiến độ Jira Cloud
- **Môn học:** Tự động hóa Quy trình Doanh nghiệp (Business Process Automation & Intelligent Automation)
- **Luồng nghiệp vụ:** **FLOW 13 — AUTOMATED DAILY STANDUP & SPRINT HEALTH WATCHDOG**
- **Mục tiêu cốt lõi:**  
  Chuyển đổi hệ thống từ mô hình **Bị động (Passive Webhook)** sang **Chủ động 24/7 (Proactive Cron/Time-driven Automation)**. Đúng **08:00 AM** mỗi ngày, cỗ máy n8n tự động thức dậy, quét tiến độ toàn bộ Issue trên Jira Cloud, dùng AI phát hiện task có nguy cơ tắc nghẽn (Bottleneck/Overdue) và gửi bản tin Standup trực tiếp vào kênh Discord/Slack của team kèm cơ chế Human-in-the-loop điều khiển trực tiếp trên Web.

### Bảng đối soát tiêu chuẩn số lượng Nodes theo yêu cầu của Giảng viên:

| Tiêu chí kỹ thuật | Yêu cầu của Giảng viên | Kết quả triển khai thực tế | Đánh giá |
|:---|:---:|:---:|:---:|
| **Số lượng Step / Node tối thiểu** | $\ge$ 12 Steps/Nodes | **14 Nodes trực quan** | ✅ VƯỢT CHUẨN (14/12) |
| **Cơ chế kích hoạt (Trigger)** | Hỗ trợ Cron / Schedule | Schedule 08:00 AM & Manual Demo | ✅ ĐẠT CHUẨN 100% |
| **Giao diện điều khiển Web** | Có công tắc & tùy chỉnh lịch | Tích hợp tại `SettingsPage.jsx` | ✅ ĐẠT CHUẨN 100% |
| **Tính năng Demo trực tiếp** | Bấm chạy thử tức thì | Nút *"Chạy thử Standup ngay"* | ✅ SẴN SÀNG DEMO |
| **Vết kiểm toán (Audit Trail)** | Lưu lịch sử chạy tự động | Bảng `automation_execution_logs` | ✅ ĐẠT CHUẨN 100% |

---

## II. DANH SÁCH CHI TIẾT 14 MAIN NODES N8N (FLOW 13)

File workflow: [`n8n/workflows/flow-13-daily-standup-watchdog.json`](file:///home/quan/ai-jira-agent/n8n/workflows/flow-13-daily-standup-watchdog.json)

| STT | Tên Node trên Canvas n8n | Loại Node (n8n Type) | Chức năng kỹ thuật thực tế |
|:---:|:---|:---|:---|
| **01** | `MAIN 01 — Standup Trigger` | `n8n-nodes-base.webhook` | Tiếp nhận tín hiệu kích hoạt tự động theo lịch Cron (08:00 AM) hoặc yêu cầu kích hoạt tức thì từ Web Dashboard qua HTTP POST `/webhook/daily-standup`. |
| **02** | `MAIN 02 — Normalize Inbound Parameters` | `n8n-nodes-base.code` | Chuẩn hóa dữ liệu đầu vào: `userId`, `isManual`, `channel`, làm sạch URL backend và gán dấu thời gian ISO 8601. |
| **03** | `MAIN 03 — Verify Scheduler Configuration (If)` | `n8n-nodes-base.if` | Kiểm tra tính hợp lệ của phiên chạy (xác thực `userId` tồn tại và kiểm tra công tắc `standup_enabled`). |
| **04** | `MAIN 04 — Fetch Standup Context & Jira Issues` | `n8n-nodes-base.httpRequest` | Gọi Backend Internal API nạp danh sách các Issue từ CSDL PostgreSQL và Jira REST API cùng cấu hình bảo mật. |
| **05** | `MAIN 05 — Analyze Sprint Issues Dataset` | `n8n-nodes-base.code` | Bóc tách ma trận phân bổ công việc: đếm số lượng task `In Progress`, `Done`, `To Do` và tự động nhận diện các task bị kẹt hoặc quá hạn. |
| **06** | `MAIN 06 — Agile Risk Gate Check (If)` | `n8n-nodes-base.if` | Rẽ nhánh điều kiện: Nếu `issuesAtRisk > 0` chuyển sang phân tích rủi ro (MAIN 07); nếu không có rủi ro chuyển sang kịch bản ổn định (MAIN 08). |
| **07** | `MAIN 07 — Synthesize High Risk Narrative` | `n8n-nodes-base.code` | Tạo khuyến nghị cảnh báo đỏ/vàng cam, chỉ rõ mã Issue cần chú ý và đề xuất Scrum Master điều phối lại nguồn lực. |
| **08** | `MAIN 08 — Synthesize Healthy Sprint Narrative` | `n8n-nodes-base.code` | Tạo thông điệp tích cực ghi nhận vận tốc Sprint ổn định và các task hoàn tất vượt tiến độ. |
| **09** | `MAIN 09 — Merge Narrative Streams` | `n8n-nodes-base.code` | Hợp nhất luồng phân tích, gán định dạng ngày tháng tiếng Việt chuẩn (`Thứ X, ngày DD/MM/YYYY`). |
| **10** | `MAIN 10 — Route Notification Channel (Switch)` | `n8n-nodes-base.switch` | Điều hướng theo kênh người dùng đã chọn trên web: Output 0 $\rightarrow$ Discord; Output 1 $\rightarrow$ Slack; Output 2 $\rightarrow$ Email. |
| **11** | `MAIN 11 — Format Discord Rich Embed` | `n8n-nodes-base.code` | Định dạng bản tin Discord Embed cao cấp với thanh màu trạng thái (`#f59e0b` / `#10b981`), Avatar bot và chia 3 trường thông tin rõ ràng. |
| **12** | `MAIN 12 — Format Slack & Email Payload` | `n8n-nodes-base.code` | Định dạng khối Block Kit cho Slack hoặc mã HTML hiển thị bảng cho hòm thư Email. |
| **13** | `MAIN 13 — Assemble Execution Summary DTO` | `n8n-nodes-base.code` | Đóng gói toàn bộ số liệu thống kê (`issuesScanned`, `issuesAtRisk`, `executionSLA`) chuẩn bị lưu log và phản hồi. |
| **14** | `MAIN 14 — Respond to Standup Webhook (200 OK)` | `n8n-nodes-base.respondToWebhook` | Đóng vòng lặp Webhook, phản hồi mã HTTP 200 OK kèm đầy đủ metadata phân tích thời gian thực. |

---

## III. TÍNH NĂNG ĐÃ BỔ SUNG TRÊN GIAO DIỆN WEB ([SettingsPage.jsx](file:///home/quan/ai-jira-agent/frontend/src/pages/SettingsPage.jsx))

Tại trang **Cài đặt Tích hợp**, hệ thống đã bổ sung **Section 4: Lịch Tự Động Hóa & Giám Sát Tiến Độ (Daily Standup Watchdog)** gồm:

1. **Công tắc Bật/Tắt:** `standup_enabled` (Lưu trực tiếp vào CSDL PostgreSQL).
2. **Chọn giờ gửi báo cáo:** Danh sách giờ linh hoạt (`08:00 (Sáng sớm)`, `08:30`, `09:00`, `09:30`, `17:30`).
3. **Chọn ngày chạy:** `Thứ 2 đến Thứ 6 (Ngày làm việc)`, `Hàng ngày (Cả tuần)`.
4. **Chọn múi giờ:** `Asia/Ho_Chi_Minh (GMT+7)`, `UTC`, `Asia/Tokyo`.
5. **Chọn kênh nhận:** `Discord Webhook`, `Slack Webhook`, `Email`.
6. **Thanh kích hoạt thử nghiệm tức thì (Demo Trigger):**
   - Nút **"⚡ Chạy thử báo cáo Standup ngay"**: Cho phép người bảo vệ demo trước hội đồng mà không cần đợi đến 08:00 sáng hôm sau.
   - Hiển thị phản hồi thông báo thành công cùng số task đã quét và thời gian phản hồi (ms).
7. **Bảng Nhật ký Tự động hóa Gần đây (Execution Audit Trail):**
   - Hiển thị danh sách các lần n8n chạy: Thời gian, Workflow ID, Kiểu chạy (`⏰ Lịch Cron` / `⚡ Chạy thử`), Trạng thái (`✓ Thành công` / `✗ Thất bại`), Số task quét được, Số task rủi ro, Độ trễ execution (ms).
   - Có nút **"Làm mới"** để cập nhật nhật ký thời gian thực.

---

## IV. CƠ SỞ DỮ LIỆU & KIẾN TRÚC MÃ NGUỒN ĐÃ BỔ SUNG

1. **Database Migration:** [`backend/src/migrations/009_create_automation_scheduler_schema.sql`](file:///home/quan/ai-jira-agent/backend/src/migrations/009_create_automation_scheduler_schema.sql).
   - Thêm 5 cột cấu hình vào bảng `configurations`.
   - Tạo bảng `automation_execution_logs` phục vụ lưu vết kiểm toán.
2. **Model:** [`backend/src/models/automationLog.model.js`](file:///home/quan/ai-jira-agent/backend/src/models/automationLog.model.js) & [`backend/src/models/config.model.js`](file:///home/quan/ai-jira-agent/backend/src/models/config.model.js).
3. **Service:** [`backend/src/services/automation.service.js`](file:///home/quan/ai-jira-agent/backend/src/services/automation.service.js).
4. **Controller & Routes:** [`backend/src/controllers/config.controller.js`](file:///home/quan/ai-jira-agent/backend/src/controllers/config.controller.js) & [`backend/src/routes/config.routes.js`](file:///home/quan/ai-jira-agent/backend/src/routes/config.routes.js) (`POST /api/config/test-standup`, `GET /api/config/automation-logs`).
5. **Frontend API:** [`frontend/src/api/configApi.js`](file:///home/quan/ai-jira-agent/frontend/src/api/configApi.js).
6. **Frontend View & Styling:** [`frontend/src/pages/SettingsPage.jsx`](file:///home/quan/ai-jira-agent/frontend/src/pages/SettingsPage.jsx) & [`frontend/src/App.css`](file:///home/quan/ai-jira-agent/frontend/src/App.css).
