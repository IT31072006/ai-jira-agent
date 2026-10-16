# KỊCH BẢN DEMO TOÀN TRÌNH HỆ THỐNG AI JIRA AGENT (END-TO-END DEMO SCRIPT)

- **Mục tiêu:** Trình diễn quy trình khép kín từ khâu tiếp nhận yêu cầu phần mềm thô bằng ngôn ngữ tự nhiên đến khi bóc tách thành cấu trúc Agile chuẩn, đồng bộ Jira và xuất báo cáo kỹ thuật.
- **Thời lượng dự kiến:** 8 – 10 phút.
- **Môi trường demo:** Frontend (`http://localhost:5173`), Backend (`http://localhost:5000`), CSDL PostgreSQL (`localhost:5432`).
- **Nguyên tắc:** Minh bạch giữa bước chạy Live 100% tại chỗ và bước mô phỏng dịch vụ đám mây (Simulation).

---

## BỘ DỮ LIỆU YÊU CẦU PHẦN MỀM MẪU (SAMPLE REQUIREMENT DATASET)

> **Dự án:** Ứng dụng Đặt xe Công nghệ Trực tuyến (SmartRide App)  
> **Nội dung yêu cầu nhập vào AI:**  
> *"Xây dựng hệ thống cho phép khách hàng đặt xe qua ứng dụng di động, tự động định vị GPS và tìm tài xế gần nhất trong bán kính 3km, tính toán cước phí chuyến đi theo quãng đường và thời gian thực, hỗ trợ thanh toán qua Ví điện tử MoMo/ZaloPay hoặc Tiền mặt, đồng thời cho phép khách hàng chấm điểm tài xế từ 1 đến 5 sao và viết bình luận sau khi hoàn thành chuyến đi."*

### Cấu trúc kết quả mong đợi sau khi bóc tách:
- **Epic 1: Quản lý Đặt xe & Ghép chuyến (Ride Booking & Driver Matching)**
  - *User Story 1.1:* Khách hàng chọn điểm đón và điểm đến trên bản đồ.
    - `Task 1.1.1:` Tích hợp Google Maps API & GPS định vị thời gian thực.
    - `Task 1.1.2:` Thuật toán tính toán quãng đường và ước lượng cước phí.
  - *User Story 1.2:* Hệ thống tự động ghép tài xế khả dụng gần nhất.
    - `Task 1.2.1:` Truy vấn danh sách tài xế đang online trong bán kính 3km.
    - `Task 1.2.2:` Gửi thông báo nhận chuyến tới ứng dụng của tài xế.
- **Epic 2: Thanh toán & Đánh giá Dịch vụ (Payment & Quality Rating)**
  - *User Story 2.1:* Khách hàng thanh toán cước chuyến đi đa phương thức.
    - `Task 2.1.1:` Tích hợp cổng thanh toán Ví điện tử MoMo / ZaloPay.
    - `Task 2.1.2:` Xử lý hoàn tiền tự động khi khách hàng hoặc tài xế hủy chuyến.
  - *User Story 2.2:* Khách hàng phản hồi chất lượng dịch vụ.
    - `Task 2.2.1:` Giao diện đánh giá 1-5 sao và nhập nhận xét cho tài xế.

---

## CHI TIẾT 12 PHẦN DEMO TƯƠNG ỨNG 12 LUỒNG NGHIỆP VỤ

### Phần 1: Đăng nhập & Xác thực phiên làm việc (Luồng 1)
- **Thao tác trên giao diện:**
  1. Truy cập `http://localhost:5173/login`.
  2. Nhập Email: `tranthang20060903@gmail.com`, Mật khẩu: `password123`.
  3. Bấm nút **"Đăng nhập"**.
- **Kết quả xuất hiện:** Hệ thống xác thực thành công, lưu JWT vào LocalStorage, tự động chuyển hướng vào màn hình `/dashboard`.
- **Thành phần tham gia:** Frontend React (`LoginPage`), Express Backend (`/api/auth/login`), PostgreSQL (`users` table, `bcrypt.compare`).
- **Trạng thái thực thi:** **LIVE 100%**.

---

### Phần 2: Quản lý Không gian làm việc / Workspace (Luồng 2)
- **Thao tác trên giao diện:**
  1. Click menu **"Dự án"** (`/projects`).
  2. Bấm nút **"+ Tạo dự án mới"**.
  3. Nhập Tên dự án: *"SmartRide Platform"*, Mô tả: *"Hệ thống đặt xe công nghệ trực tuyến"*, Mã dự án Jira: *"SMR"*.
  4. Bấm **"Lưu dự án"**.
- **Kết quả xuất hiện:** Thẻ dự án *"SmartRide Platform"* xuất hiện trong danh sách kèm mã `SMR`. Click vào thẻ dự án để vào trang chi tiết `/projects/:id`.
- **Thành phần tham gia:** React (`ProjectsPage`, `ProjectModal`), Express Backend (`/api/projects`), PostgreSQL (`projects` table).
- **Trạng thái thực thi:** **LIVE 100%**.

---

### Phần 3: Cấu hình tích hợp & Bảo mật Khóa API (Luồng 3)
- **Thao tác trên giao diện:**
  1. Click menu **"Cài đặt"** (`/settings`).
  2. Quan sát phần tích hợp Jira Cloud và Webhook Notification.
  3. Nhập Jira Domain: `https://tranthang20060903.atlassian.net` (hoặc nhập `tranthang20060903.atlassian.net` để chứng minh tính năng tự chuẩn hóa).
  4. Nhập Jira Email: `tranthang20060903@gmail.com`.
  5. Nhập Jira API Token: `********` (được che giấu an toàn).
  6. Bấm **"Lưu cài đặt"**.
- **Kết quả xuất hiện:** Thông báo *"Cấu hình đã được lưu thành công"*. Khóa bí mật được mã hóa **AES-256-GCM** trong DB và trả về dạng mask `********`.
- **Thành phần tham gia:** React (`SettingsPage`), Express (`/api/config`), CryptoService (`aes-256-gcm`, IV 12B, Tag 16B).
- **Trạng thái thực thi:** **LIVE 100%**.

---

### Phần 4 & 5: AI Phân tích yêu cầu & Trực quan hóa Cây phân cấp (Luồng 4 & 5)
- **Thao tác trên giao diện:**
  1. Quay lại trang Chi tiết dự án *"SmartRide Platform"*.
  2. Dán đoạn yêu cầu mẫu ở trên vào ô textarea **"Nội dung Yêu cầu (Requirement)"**.
  3. Bấm nút **"Phân tích bằng AI"**.
- **Kết quả xuất hiện:**
  - Hiệu ứng Spinner quay: *"AI đang phân tích và bóc tách..."*.
  - Khối kết quả phân cấp hiển thị sắc nét: **2 Epics**, **4 User Stories**, **8 Tasks**.
  - Người thuyết trình click vào từng tiêu đề Epic và Story để trình diễn tính năng mở rộng (Expand) / thu gọn (Collapse).
- **Thành phần tham gia:** React (`RequirementAnalyzer.jsx`), Express (`/api/ai/analyze`), n8n (`flow-4-ai-requirement`), Google Gemini Pro.
- **Trạng thái thực thi:**
  - *Nếu n8n đang chạy:* **LIVE 100%** qua Gemini.
  - *Nếu n8n chưa chạy:* Giao diện hiển thị cảnh báo hướng dẫn khởi động n8n (chứng minh tính năng bắt lỗi an toàn HTTP 503 mới sửa). Sau đó người demo nạp dữ liệu mẫu cấu trúc cây đã chuẩn bị sẵn để chuyển sang Bước 6.

---

### Phần 6: Phê duyệt, Chỉnh sửa & Khóa bản nháp (Luồng 6)
- **Thao tác trên giao diện:**
  1. Tại Story 1.1, bấm nút **"+ Thêm Task"** $\rightarrow$ Nhập tên: *"Tích hợp thông báo cước phí qua SMS Brandname"*.
  2. Sửa tiêu đề Epic 1 thành: *"Quản lý Đặt xe & Ghép cuốc (Smart Dispatcher)"*.
  3. Xóa một Task không cần thiết bằng cách bấm biểu tượng thùng rác màu đỏ.
  4. Bấm nút **"Xác nhận kết quả"** (nút màu xanh với biểu tượng Khóa).
- **Kết quả xuất hiện:**
  - Toàn bộ các ô nhập liệu chuyển sang trạng thái tĩnh (Read-only).
  - Xuất hiện huy hiệu màu xanh: *"✓ Đã xác nhận"*.
  - Khối tính năng *"Tích hợp Jira (Push to Jira)"* tự động mở ra ở bên dưới.
- **Thành phần tham gia:** React State Management (`editableEpics`, `confirmed = true`, immutable updates).
- **Trạng thái thực thi:** **LIVE 100%**.

---

### Phần 7 & 8: Lấy thành viên Jira & Đẩy dữ liệu lên Jira Cloud (Luồng 7 & 8)
- **Thao tác trên giao diện:**
  1. Tại khối Tích hợp Jira, kiểm tra mã dự án Jira (ví dụ: `SMR` hoặc `KAN`).
  2. Bấm nút **"Lấy thành viên Jira"** $\rightarrow$ Danh sách thành viên trong nhóm Jira Cloud được nạp vào các dropdown giao việc (Assignee Selector).
  3. Chọn Assignee cho Story 1.1 là *"Tran Minh Thang"*.
  4. Bấm nút **"Đẩy lên Jira"**.
- **Kết quả xuất hiện:**
  - Hiệu ứng đẩy tuần tự: Tạo Epic $\rightarrow$ Lấy Epic Key $\rightarrow$ Tạo Story liên kết Epic $\rightarrow$ Tạo Sub-task liên kết Story.
  - Bảng kết quả hiển thị danh sách các mã Jira Issue đã tạo kèm link bấm trực tiếp: `[SMR-101]`, `[SMR-102]`,...
- **Thành phần tham gia:** Express Backend (`/api/jira/push`), Jira REST API v3 / n8n Workflow 7, PostgreSQL (`jira_issues`).
- **Trạng thái thực thi:**
  - *Môi trường Jira Cloud Sandbox:* **LIVE 100%** nếu có kết nối mạng ngoài.
  - *Môi trường Local Demo:* Trình diễn cơ chế Validation tham số và ghi nhận vào bảng `jira_issues` với mã định danh.

---

### Phần 9: Đồng bộ trạng thái ngược từ Webhook Jira (Luồng 9)
- **Thao tác trên giao diện:**
  1. Mở tính năng Giả lập Webhook Jira (hoặc gọi qua endpoint `/api/jira/test-webhook-sync`).
  2. Gửi sự kiện chuyển trạng thái Issue `SMR-101` từ *"To Do"* sang *"In Progress"*, và `SMR-102` sang *"Done"*.
  3. Mở tab **"Bảng đồng bộ Jira"** trên ứng dụng.
- **Kết quả xuất hiện:** Bảng trạng thái cập nhật ngay lập tức: Issue `SMR-101` mang nhãn màu xanh dương *"In Progress"*, Issue `SMR-102` mang nhãn màu xanh lá *"Done"*. Cơ chế Upsert đảm bảo không bao giờ bị nhân đôi bản ghi.
- **Thành phần tham gia:** Express (`/api/webhooks/jira-sync`, `/api/jira/test-webhook-sync`), PostgreSQL (`jira_issues`).
- **Trạng thái thực thi:** **LIVE 100%**.

---

### Phần 10: Dashboard Thống kê & Báo cáo Tiến độ (Luồng 10)
- **Thao tác trên giao diện:**
  1. Click menu **"Dashboard"** (`/dashboard`).
  2. Quan sát các chỉ số thống kê tổng hợp thời gian thực.
- **Kết quả xuất hiện:**
  - Thẻ KPI: Tổng số dự án (4), Tổng số Issue (158+), Tỷ lệ hoàn thành (Completion Rate) tự động tính toán lại dựa trên các issue vừa Done.
  - Biểu đồ phân bổ trạng thái tròn: Tỷ lệ To Do / In Progress / Done với mã màu phân biệt.
  - Biểu đồ xu hướng tạo Issue theo ngày trong tháng (Asia/Ho_Chi_Minh).
- **Thành phần tham gia:** React (`DashboardPage.jsx`, Recharts), Express (`/api/dashboard/summary`), PostgreSQL SQL Aggregations.
- **Trạng thái thực thi:** **LIVE 100%**.

---

### Phần 11: Thông báo Đa kênh Tự động (Luồng 11)
- **Thao tác trên giao diện:**
  1. Kiểm tra phần lịch sử thông báo tại Dashboard hoặc qua API.
  2. Trình diễn cơ chế kiểm soát Idempotency Key: Khi sự kiện đổi trạng thái ở Bước 9 xảy ra, một bản ghi được tạo trong bảng `notification_events` với trạng thái `pending`.
  3. Gửi lại cùng một event ID $\rightarrow$ Hệ thống chứng minh không bị gửi trùng (ON CONFLICT DO NOTHING).
- **Kết quả xuất hiện:** Bản ghi sự kiện thông báo được ghi nhận với đầy đủ payload, kênh Discord/Slack và header bí mật `X-Webhook-Secret`.
- **Thành phần tham gia:** Express Backend (`NotificationService`), n8n (`flow-11-epic-notification`), PostgreSQL (`notification_events`).
- **Trạng thái thực thi:** **LIVE 100%** kiểm tra logic CSDL & chống trùng; bắn tin nhắn thật phụ thuộc Incoming Webhook URL.

---

### Phần 12: Xuất Báo cáo Tài liệu Kỹ thuật Đa định dạng (Luồng 12)
- **Thao tác trên giao diện:**
  1. Tại màn hình dự án, bấm nút **"Xuất tài liệu (Export)"**.
  2. Chọn định dạng **Markdown (.md)** $\rightarrow$ Bấm Tải về.
  3. Chọn định dạng **PDF (.pdf)** $\rightarrow$ Bấm Tải về.
  4. Mở trực tiếp cả 2 file vừa tải về máy để Hội đồng nghiệm thu kiểm tra.
- **Kết quả xuất hiện:**
  - File Markdown: Cấu trúc phân cấp `# Dự án: SmartRide Platform`, mục lục, liên kết Jira, trạng thái rõ ràng.
  - File PDF: Trình bày dạng báo cáo kỹ thuật chuyên nghiệp, nhúng font `DejaVuSans.ttf`, hiển thị tiếng Việt có dấu chuẩn 100% (không lỗi font, không ô vuông/hỏi chấm), có số trang tự động và tuyệt đối không rò rỉ bất kỳ API Key nào.
- **Thành phần tham gia:** Express (`/api/projects/:id/export`), PDFKit Unicode Engine, PostgreSQL (`jira_issues`).
- **Trạng thái thực thi:** **LIVE 100%**.
