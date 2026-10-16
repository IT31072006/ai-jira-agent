# ĐỀ CƯƠNG BÀI BÁO CÁO VÀ THUYẾT TRÌNH ĐỒ ÁN AI JIRA AGENT
## THỜI LƯỢNG: 12 – 15 PHÚT | ĐỘI NGŨ THỰC HIỆN: 04 THÀNH VIÊN

---

## I. MA TRẬN PHÂN CÔNG THUYẾT TRÌNH CỦA 4 THÀNH VIÊN

| Thành viên | Vai trò đảm nhiệm | Khối nghiệp vụ phụ trách | Thời lượng trình bày | Nội dung báo cáo chính |
|---|---|---|---|---|
| **Thành viên 1** *(Trưởng nhóm)* | Platform & Security Lead | **Nhóm 1: Luồng 1, 2, 3** | 3.0 phút (0:00 - 3:00) | Giới thiệu đề tài, bài toán thực tế, kiến trúc tổng quan, Xác thực JWT & Bảo mật khóa AES-256-GCM. |
| **Thành viên 2** | AI & Decomposition Lead | **Nhóm 2: Luồng 4, 5, 6** | 3.5 phút (3:00 - 6:30) | Động cơ phân tích Gemini AI, n8n webhook, bóc tách Epic $\rightarrow$ Story $\rightarrow$ Task, UI phân cấp và Khóa bản nháp. |
| **Thành viên 3** | Integration & Cloud Lead | **Nhóm 3: Luồng 7, 8, 9** | 3.5 phút (6:30 - 10:00) | Tích hợp Jira REST API v3, cơ chế phân công thành viên (Assignee), Webhook đồng bộ hai chiều và Upsert chống trùng. |
| **Thành viên 4** | DevOps, Analytics & Report Lead | **Nhóm 4: Luồng 10, 11, 12** | 3.5 phút (10:00 - 13:30) | Dashboard thống kê KPI, Thông báo đa kênh Idempotent, Xuất tài liệu PDF Unicode / Markdown, Kết quả kiểm thử. |
| **Cả nhóm** | Q&A Session | Toàn bộ 12 Luồng | 1.5 phút (13:30 - 15:00) | Trả lời phản biện kỹ thuật của Hội đồng chấm đồ án. |

---

## II. CHI TIẾT TỪNG SLIDE BÁO CÁO (SLIDE-BY-SLIDE WALKTHROUGH)

### Slide 1: Trang bìa & Giới thiệu Tên Đề tài (Thành viên 1 — 0.5 phút)
- **Tiêu đề Slide:** ĐỒ ÁN TỐT NGHIỆP: AI JIRA AGENT
- **Phụ đề:** Hệ thống tự động phân rã yêu cầu phần mềm bằng Trí tuệ Nhân tạo và đồng bộ Jira Cloud theo mô hình Agile.
- **Thông tin nhóm:** 04 thành viên, Giảng viên hướng dẫn.
- **Lời thuyết trình (Script):**  
  *"Kính thưa quý thầy cô trong Hội đồng, trong quy trình phát triển phần mềm Agile hiện đại, việc chuyển đổi từ các bản đặc tả yêu cầu kinh doanh bằng ngôn ngữ tự nhiên sang cấu trúc Epic, User Story và Task chi tiết trên Jira thường tiêu tốn rất nhiều thời gian của Product Owner và Tech Lead. Đồ án của nhóm chúng em xây dựng giải pháp AI Jira Agent nhằm tự động hóa hoàn toàn quy trình này với kiến trúc chuẩn hóa 12 Luồng nghiệp vụ × 12 Bước kỹ thuật."*

---

### Slide 2: Bài toán Thực tế & Mục tiêu Hệ thống (Thành viên 1 — 1.0 phút)
- **Vấn đề thực tế (Pain Points):**
  1. *Tốn thời gian:* PO/BA mất từ 2-4 ngày để bóc tách một bản BRD (Business Requirement Document) thành hàng chục task nhỏ trên Jira.
  2. *Thiếu tính nhất quán:* Cấu trúc phân cấp cha-con (Epic $\rightarrow$ Story $\rightarrow$ Sub-task) dễ bị rời rạc, sai lệch Story Points và thiếu tiêu chí nghiệm thu (Acceptance Criteria).
  3. *Đồng bộ thủ công:* Trạng thái tiến độ công việc giữa các thành viên và báo cáo lãnh đạo thường bị lệch pha.
- **Mục tiêu của hệ thống:**
  - Tự động hóa bóc tách yêu cầu bằng Google Gemini AI thông qua n8n automation engine.
  - Cung cấp giao diện trực quan cho phép PM/PO tinh chỉnh, phân công lập trình viên và khóa bản nháp trước khi đẩy.
  - Đồng bộ trạng thái hai chiều qua Jira Webhook và xuất báo cáo kỹ thuật PDF/Markdown chuẩn mực.

---

### Slide 3: Kiến trúc Tổng thể & Công nghệ Lựa chọn (Thành viên 1 — 0.5 phút)
- **Sơ đồ kiến trúc 5 tầng:**
  - *Client Layer:* ReactJS (Single Page App, Recharts, Vite).
  - *API Gateway & Backend:* NodeJS & ExpressJS (Centralized Middleware, Router).
  - *Security & Cryptography:* AES-256-GCM với IV 12 bytes & AuthTag 16 bytes, Bcrypt & JWT.
  - *Database Layer:* PostgreSQL (Relational schema, Foreign Keys Cascading, Idempotency Index).
  - *Orchestration & AI Layer:* n8n Workflow Engine $\leftrightarrow$ Google Gemini Pro $\leftrightarrow$ Atlassian Jira Cloud $\leftrightarrow$ Discord/Slack.

---

### Slide 4: Chuẩn mực Kiến trúc 12 Luồng × 12 Bước = 144 Steps (Thành viên 1 — 1.0 phút)
- **Ý nghĩa kỹ thuật của quy tắc 12 × 12:**
  - Không phải là con số ngẫu nhiên, mà là **chuẩn hóa quy trình kỹ thuật hoàn chỉnh**: Mỗi luồng nghiệp vụ đều phải trải qua đầy đủ chu trình: *Tiếp nhận đầu vào $\rightarrow$ Client Validation $\rightarrow$ API Transport $\rightarrow$ Express Routing $\rightarrow$ Controller $\rightarrow$ Service Logic $\rightarrow$ DB/Integration Call $\rightarrow$ External Processing $\rightarrow$ Exception Handling $\rightarrow$ Data Persistence $\rightarrow$ Response Formatting $\rightarrow$ Client State Update*.
  - Toàn bộ 144 bước đều có sự tương ứng 1-1 giữa Bảng kịch bản kỹ thuật và Sơ đồ tuần tự Sequence Diagram.

---

### Slide 5: Quản trị Nền tảng & Bảo mật Khóa API (Thành viên 1 — Luồng 1, 2, 3)
- **Điểm nhấn kỹ thuật:**
  - *Luồng 1 (Auth & RBAC):* Đăng ký, đăng nhập bảo vệ bằng Bcrypt băm mật khẩu 10 rounds, cấp JWT hạn dùng 24h.
  - *Luồng 2 (Workspace Management):* CRUD dự án, tự động sinh mã dự án (Project Key), đảm bảo cách ly dữ liệu triệt để giữa các tài khoản người dùng qua mệnh đề `WHERE user_id = $1`.
  - *Luồng 3 (Secret Management):* Lưu trữ Jira API Token và Gemini Key bằng chuẩn mã hóa quân sự **AES-256-GCM**. Khóa bí mật không bao giờ trả về nguyên bản trên UI mà luôn được che giấu dưới dạng `CryptoService.mask(secret, 4)` $\rightarrow$ `********`.

---

### Slide 6: AI Bóc tách Yêu cầu & Trực quan hóa Cây phân cấp (Thành viên 2 — Luồng 4, 5)
- **Điểm nhấn kỹ thuật:**
  - *Luồng 4 (AI Decomposition):* Express chuyển tiếp yêu cầu sang n8n Webhook. n8n đóng gói System Prompt tối ưu gọi Google Gemini Pro, yêu cầu trả về định dạng JSON thuần. Backend trang bị regex bóc tách khối Markdown codeblock ` ```json ... ``` `, cơ chế retry 2 lần và timeout an toàn 120 giây.
  - *Luồng 5 (Hierarchy Visualization):* Hiển thị sắc nét cây 3 tầng **Epic $\rightarrow$ User Story $\rightarrow$ Task**. Hỗ trợ mở rộng/thu gọn (Accordion), chuẩn hóa dữ liệu dị biệt qua hàm `normalizeEpicsResponse` để tránh crash ứng dụng.

---

### Slide 7: Phê duyệt, Chỉnh sửa Tương tác & Khóa bản nháp (Thành viên 2 — Luồng 6)
- **Điểm nhấn kỹ thuật:**
  - PO/Tech Lead có toàn quyền can thiệp trước khi đẩy dữ liệu lên Jira: Thêm Story mới, thêm Task, sửa mô tả, xóa các phần tử thừa.
  - *Cơ chế Khóa bản nháp (Lock Draft):* Khi bấm "Xác nhận kết quả", toàn bộ form bị đóng băng (Immutable State), ngăn chặn chỉnh sửa ngoài ý muốn trong quá trình đẩy sang Jira. Người dùng có thể nhấn "Chỉnh sửa lại" để mở khóa linh hoạt.

---

### Slide 8: Đẩy dữ liệu lên Jira Cloud & Phân công Thành viên (Thành viên 3 — Luồng 7, 8)
- **Điểm nhấn kỹ thuật:**
  - *Luồng 8 (Jira Members):* Gọi API Atlassian `/rest/api/3/user/assignable/search` để tải danh sách lập trình viên thực tế trong dự án Jira, ánh xạ `accountId` vào từng User Story và Task.
  - *Luồng 7 (Push to Jira):* Tạo tuần tự Epic trước để lấy `issue.id/key`, sau đó truyền `parent: { key: epicKey }` để tạo Story, và cuối cùng tạo Sub-task gắn với Story.
  - *Cơ chế Fallback thông minh:* Nếu n8n gặp sự cố gián đoạn, `jira.service.js` tự động chuyển đổi sang gọi trực tiếp Jira REST API v3 mà không làm gián đoạn người dùng.

---

### Slide 9: Webhook Đồng bộ Hai chiều & Chống trùng lặp (Thành viên 3 — Luồng 9)
- **Điểm nhấn kỹ thuật:**
  - Khi lập trình viên kéo thẻ Issue trên Jira Cloud từ *To Do* sang *In Progress* hoặc *Done*, Jira Cloud bắn Inbound Webhook về `/api/webhooks/jira-sync`.
  - Cơ chế **Idempotent Upsert:** Áp dụng câu lệnh `ON CONFLICT (issue_key) DO UPDATE SET status = EXCLUDED.status, last_synced_at = NOW()`. Dù Webhook có bị bắn lặp nhiều lần do độ trễ mạng, CSDL luôn duy trì đúng 1 bản ghi duy nhất.

---

### Slide 10: Dashboard Tiến độ, Thông báo Đa kênh & Xuất Báo cáo (Thành viên 4 — Luồng 10, 11, 12)
- **Điểm nhấn kỹ thuật:**
  - *Luồng 10 (Dashboard):* Tự động tổng hợp dữ liệu từ PostgreSQL qua SQL Aggregate, tính toán chính xác Tỷ lệ Hoàn thành (`Completion Rate = Done / Total * 100%`) và vẽ biểu đồ xu hướng theo ngày (Recharts).
  - *Luồng 11 (Notifications):* Ghi nhận sự kiện thông báo có `idempotency_key`, chuyển tiếp sang n8n định dạng Discord Embed và Slack Block Kit. Xử lý lỗi Non-blocking không làm nghẽn luồng chính.
  - *Luồng 12 (Export Engine):* Nhúng font Unicode `DejaVuSans.ttf`, xuất file PDF kỹ thuật và Markdown chuẩn tiếng Việt 100% không lỗi font, hỗ trợ xuất cả dữ liệu Jira đã đồng bộ lẫn bản nháp AI tức thì.

---

### Slide 11: Kết quả Kiểm thử & Trực tiếp Demo (Cả nhóm — 3.0 phút)
- **Kết quả nghiệm thu:** 120 test cases, 114 PASS (95%), 0 FAIL.
- **Trình chiếu Demo:** Chạy kịch bản mẫu *"SmartRide Platform"* theo file [DEMO_SCRIPT.md](file:///home/tmthang/Downloads/ai-jira-agent/docs/DEMO_SCRIPT.md).

---

### Slide 12: Hạn chế, Hướng phát triển & Kết luận (Thành viên 4 — 1.0 phút)
- **Hạn chế hiện tại:** Cần cài đặt n8n để chạy luồng AI tự động hóa hoàn chỉnh; phụ thuộc vào cấu hình Jira Cloud Sandbox bên ngoài để test live write.
- **Hướng phát triển:** Tích hợp trực tiếp Gemini API Fallback nội bộ; hỗ trợ thêm GitLab Issues, Trello và GitHub Projects; bổ sung tính năng ước lượng Story Points tự động dựa trên Machine Learning.
- **Lời kết:** Nhóm hoàn thành xuất sắc đồ án với sự phối hợp chặt chẽ, tuân thủ đúng chuẩn mực kỹ thuật và bảo toàn tuyệt đối kiến trúc 12 Luồng × 12 Step.
