# BỘ CÂU HỎI VÀ TRẢ LỜI PHẢN BIỆN KỸ THUẬT (DEFENSE Q&A CHEAT SHEET)
## BẢO VỆ ĐỒ ÁN: HỆ THỐNG AI JIRA AGENT

---

### Câu 1: Vì sao nhóm chọn đề tài AI Requirement-to-Jira Agent?
**Trả lời:**  
Trong quy trình phát triển phần mềm theo chuẩn Agile/Scrum, khâu chuyển dịch từ yêu cầu nghiệp vụ của khách hàng (BRD/User Requirement) sang backlog kỹ thuật trên Jira là một trong những điểm nghẽn (bottleneck) lớn nhất. Công việc này mang tính lặp đi lặp lại, tốn nhiều giờ của Product Owner/Tech Lead và dễ xảy ra sai sót trong việc phân cấp quan hệ cha-con. Đề tài giải quyết bài toán tự động hóa hoàn toàn quy trình này bằng AI, đồng thời giữ vững nguyên tắc "Human-in-the-loop" (con người kiểm tra, tinh chỉnh và phê duyệt trước khi ghi dữ liệu lên Jira Cloud).

---

### Câu 2: Vì sao hệ thống sử dụng n8n làm Automation Engine thay vì code cứng toàn bộ bằng NodeJS?
**Trả lời:**  
n8n mang lại 3 ưu thế vượt trội:
1. *Tách biệt nghiệp vụ tích hợp (Decoupling):* Các luồng điều phối nhiều bên thứ ba (Gemini $\leftrightarrow$ Jira $\leftrightarrow$ Discord/Slack) được quản lý dưới dạng workflow trực quan, dễ bảo trì và thay đổi mà không phải redeploy toàn bộ backend Express.
2. *Cơ chế Retry và Rate Limit tích hợp:* n8n có sẵn cơ chế thử lại khi API bên ngoài bị timeout hoặc vượt quá giới hạn request (Rate limiting).
3. *Định dạng thông báo đa kênh:* n8n sở hữu các node tích hợp sẵn để dựng Discord Embed và Slack Block Kit chuyên nghiệp mà không làm phình to mã nguồn NodeJS.

---

### Câu 3: Mô hình Google Gemini đóng vai trò gì trong hệ thống?
**Trả lời:**  
Gemini đóng vai trò là "Nhận thức & Phân tách Ngữ nghĩa" (Semantic Decomposition Engine):
- Tiếp nhận văn bản mô tả tự nhiên tiếng Việt hoặc tiếng Anh.
- Áp dụng kỹ thuật Prompt Engineering với Few-shot Prompting và System Instruction nghiêm ngặt.
- Bóc tách văn bản thành cây cấu trúc JSON chuẩn: Epic (tính năng lớn) $\rightarrow$ User Stories (theo format: *"Là một [người dùng], tôi muốn [hành động] để [lợi ích]"*) $\rightarrow$ Tasks/Sub-tasks kỹ thuật.
- Dự đoán sơ bộ phạm vi công việc và tiêu chí nghiệm thu cho từng Story.

---

### Câu 4: Tại sao hệ thống lựa chọn ReactJS ở Frontend và ExpressJS ở Backend?
**Trả lời:**  
- **ReactJS (Frontend):** Phù hợp tối ưu cho việc quản lý trạng thái động (State Management) của cây phân cấp 3 tầng. Khả năng render lại từng node (Epic/Story/Task) khi người dùng thêm, sửa, xóa, khóa bản nháp (Immutable State updates) giúp giao diện phản hồi mượt mà trong thời gian thực.
- **ExpressJS (Backend):** Mô hình hướng sự kiện (Event-driven, Non-blocking I/O) của NodeJS cho phép xử lý hiệu quả các tác vụ bất đồng bộ cao như nạp file, gọi webhook bên ngoài và streaming tải file PDF lớn mà không làm nghẽn tiến trình xử lý chính (Event Loop).

---

### Câu 5: Cơ sở dữ liệu PostgreSQL lưu trữ những thông tin gì?
**Trả lời:**  
PostgreSQL lưu trữ 5 bảng dữ liệu quan hệ chặt chẽ:
1. `users`: Lưu thông tin tài khoản, email duy nhất và mật khẩu băm (`password_hash`).
2. `projects`: Lưu trữ không gian làm việc (Workspace), liên kết với `user_id` qua Foreign Key (`ON DELETE CASCADE`).
3. `configurations`: Lưu domain Jira, email và các bản mã bí mật (`jira_api_token_encrypted`, `gemini_api_key_encrypted`, `discord_webhook_url`).
4. `jira_issues`: Lưu trữ bản sao các issue đã tạo hoặc đồng bộ từ Jira (`issue_key`, `summary`, `status`, `issue_type`, `parent_key`), đóng vai trò làm Data Source cho Dashboard và Báo cáo.
5. `notification_events`: Lưu lịch sử sự kiện thông báo, `idempotency_key` và trạng thái gửi (`pending`, `sent`, `failed`).

---

### Câu 6: Vì sao kiến trúc hệ thống lại được chia thành đúng 12 luồng nghiệp vụ?
**Trả lời:**  
12 luồng bao quát trọn vẹn vòng đời phát triển phần mềm (Software Development Lifecycle) từ đầu đến cuối:
- *Nhóm 1 (Quản trị & Nền tảng - Luồng 1, 2, 3):* Đảm bảo tính xác thực, phân quyền và bảo mật chìa khóa.
- *Nhóm 2 (AI & Xử lý Yêu cầu - Luồng 4, 5, 6):* Đảm bảo tiếp nhận, bóc tách và quyền kiểm soát của con người đối với dữ liệu AI sinh ra.
- *Nhóm 3 (Tích hợp Jira Cloud - Luồng 7, 8, 9):* Đảm bảo giao tiếp hai chiều với nền tảng quản trị Jira của doanh nghiệp.
- *Nhóm 4 (Báo cáo & Tự động hóa - Luồng 10, 11, 12):* Đảm bảo trực quan hóa tiến độ cho cấp quản lý, thông báo tức thì cho team và bàn giao tài liệu kỹ thuật hoàn chỉnh.

---

### Câu 7: Tại sao mỗi luồng lại có chính xác 12 bước (144 steps standard)?
**Trả lời:**  
Đây là chuẩn mực kỹ thuật nhằm đảm bảo **tính toàn vẹn quy trình (Process Completeness)**:
Mỗi một thao tác nghiệp vụ, dù đơn giản hay phức tạp, đều phải đi qua một chu trình khép kín gồm đủ 12 chặng:
1. *Tương tác Người dùng:* Nhập dữ liệu tại View.
2. *Client Validation:* Kiểm tra định dạng cơ bản tại trình duyệt.
3. *Client API Service:* Đóng gói HTTP Request.
4. *Express Route & Middleware:* Phân tích body, kiểm tra CORS và Bearer JWT.
5. *Controller Validation:* Kiểm tra tính hợp lệ nghiệp vụ.
6. *Service Logic Preparation:* Chuẩn bị payload và thuật toán xử lý.
7. *External Call / Database Query:* Gọi CSDL hoặc hệ thống ngoài.
8. *Data Processing / Crypto / Fallback:* Xử lý dữ liệu, mã hóa hoặc bắt lỗi dự phòng.
9. *Data Persistence:* Ghi nhận trạng thái mới vào CSDL PostgreSQL.
10. *HTTP Response Formatting:* Phản hồi mã trạng thái và JSON sạch (che giấu secret).
11. *Client State Update:* Cập nhật React Context / State / Cache.
12. *UI Rendering / Navigation:* Phản hồi trực quan kết quả trên màn hình người dùng.

---

### Câu 8: Epic, User Story và Sub-task trong hệ thống khác nhau như thế nào?
**Trả lời:**  
- **Epic (Cấp độ 1 - Feature):** Một khối chức năng lớn của hệ thống, không thể hoàn thành trong một Sprint ngắn (ví dụ: *"Hệ thống Xác thực & Quản lý Người dùng"*).
- **User Story (Cấp độ 2 - Requirement):** Một yêu cầu chức năng cụ thể đứng dưới góc nhìn người dùng cuối mang lại giá trị độc lập (ví dụ: *"Đăng nhập bằng tài khoản Google qua OAuth2"*).
- **Sub-task / Task (Cấp độ 3 - Technical Unit):** Công việc kỹ thuật chi tiết của lập trình viên để hoàn thành một Story (ví dụ: *"Thiết kế bảng users trong DB"*, *"Viết API callback OAuth2"*).

---

### Câu 9: Làm thế nào hệ thống liên kết được quan hệ cha-con (Parent-Child) trên Jira Cloud?
**Trả lời:**  
Hệ thống thực hiện theo thuật toán tạo tuần tự (Top-Down Creation Pipeline):
1. Đẩy các **Epic** lên Jira trước $\rightarrow$ Nhận về mảng chứa `epicId` và `epicKey` từ Jira API.
2. Khi đẩy các **User Story**, trong payload gửi lên Jira REST API v3, hệ thống truyền trường `parent: { key: epicKey }` (hoặc `fields.parent = { key: epicKey }`).
3. Khi đẩy các **Sub-task**, hệ thống truyền trường `parent: { key: storyKey }`.
Nhờ đó, cây cấu trúc phân cấp được dựng hoàn chỉnh trên Jira Cloud Board.

---

### Câu 10: Khóa API và Token bí mật của người dùng được bảo vệ như thế nào?
**Trả lời:**  
Áp dụng mô hình bảo mật đa tầng:
1. *Mã hóa đối xứng cấp cao:* Sử dụng thuật toán **AES-256-GCM** (Galois/Counter Mode). Mỗi bản ghi sử dụng một Vector khởi tạo ngẫu nhiên (IV) 12 bytes độc lập và một Authentication Tag 16 bytes. Dữ liệu lưu trong CSDL có dạng `ivHex:authTagHex:encryptedHex`. GCM bảo vệ dữ liệu chống giả mạo toàn vẹn.
2. *Che giấu dữ liệu (Data Masking):* Khi Backend trả cấu hình về cho Frontend, hàm `CryptoService.mask(secret, 4)` chỉ giữ lại 4 ký tự cuối hoặc chuyển hoàn toàn thành chuỗi `********`. Token thật không bao giờ nằm trên React State.
3. *Cơ chế Không ghi đè:* Nếu người dùng lưu cấu hình nhưng gửi lại chuỗi `********`, Backend nhận biết và giữ nguyên bản mã cũ trong CSDL.

---

### Câu 11: Cơ chế đồng bộ trạng thái hai chiều qua Jira Webhook hoạt động ra sao?
**Trả lời:**  
- Khi người dùng thay đổi trạng thái Issue trên Jira Cloud (ví dụ kéo từ *To Do* sang *Done*), Jira Cloud phát sự kiện HTTP POST `jira:issue_updated` tới endpoint webhook của hệ thống (`/api/webhooks/jira-sync`).
- Backend tiếp nhận, bóc tách `issue.key`, `fields.status.name`, `fields.assignee.displayName`.
- Thực hiện cập nhật vào CSDL qua câu lệnh SQL Upsert.
- Ngay sau đó, Backend kích hoạt bất đồng bộ (Non-blocking) Luồng 11 để phát thông báo tới Discord/Slack cho toàn đội ngũ biết tiến độ công việc vừa thay đổi.

---

### Câu 12: Hệ thống làm thế nào để tránh việc tạo issue trùng hoặc bắn thông báo lặp?
**Trả lời:**  
Áp dụng nguyên lý **Idempotency (Tính bất biến)**:
- *Với Issue Jira (Luồng 9):* Bảng `jira_issues` thiết lập ràng buộc duy nhất trên cột `issue_key`. Khi webhook gửi nhiều lần, câu lệnh `ON CONFLICT (issue_key) DO UPDATE` chỉ cập nhật trường `status` và `last_synced_at`, không bao giờ tạo dòng mới.
- *Với Thông báo (Luồng 11):* Mỗi sự kiện thông báo được gán một `idempotency_key` duy nhất sinh từ mã issue và trạng thái (ví dụ: `notif_KAN-123_Done_timestamp`). Bảng `notification_events` sử dụng `ON CONFLICT (idempotency_key) DO NOTHING` để lập tức loại bỏ các sự kiện trùng lặp.

---

### Câu 13: Nếu dịch vụ Gemini hoặc máy chủ n8n bị sập, hệ thống xử lý như thế nào?
**Trả lời:**  
Hệ thống được thiết kế theo nguyên lý **Phục hồi lỗi linh hoạt (Fault Tolerance)**:
- *Tại Luồng 4 (AI Analysis):* Backend có cơ chế thử lại (Retry) 2 lần và đặt thời gian chờ tối đa 120s. Nếu n8n offline, Backend bắt mã lỗi `ECONNREFUSED`, trả về mã lỗi HTTP 503 có cấu trúc và thông báo thân thiện. Frontend hiển thị gợi ý khắc phục mà không làm sập ứng dụng.
- *Tại Luồng 7 (Push to Jira):* Nếu webhook n8n không phản hồi hoặc trả về lỗi 404/500, hàm `pushToJira` tự động chuyển đổi sang phương thức dự phòng `createIssuesDirectlyOnJira` gọi trực tiếp Atlassian REST API.
- *Tại Luồng 11 (Notification):* Lỗi bắn thông báo được bọc trong khối try/catch riêng biệt, ghi log cảnh báo nhưng không làm ném lỗi ngược lại, đảm bảo tiến trình đồng bộ chính của Jira không bị gián đoạn.

---

### Câu 14: Làm thế nào nhóm chứng minh được toàn bộ hệ thống đang hoạt động đúng?
**Trả lời:**  
Tính đúng đắn của hệ thống được chứng minh bằng dữ liệu định lượng:
1. *Kết quả kiểm thử tự động:* 52/52 bài test tự động chạy độc lập (Luồng 11: 12 tests, Luồng 12: 40 tests) đều đạt 100% PASS.
2. *Kiểm thử tích hợp API:* 65 kịch bản API trực tiếp trên Express và PostgreSQL đều cho kết quả khớp chuẩn đặc tả.
3. *Kiểm tra hồi quy:* Tỷ lệ lỗi 0% sau khi sửa các vấn đề tiềm ẩn.
4. *Biên dịch giao diện:* Gói Frontend Vite biên dịch thành công 2555 modules không cảnh báo lỗi cú pháp.

---

### Câu 15: Vai trò và đóng góp cụ thể của từng thành viên trong nhóm 4 người là gì?
**Trả lời:**  
Dự án được phân công đồng đều theo 4 nhóm chuyên môn:
- **Thành viên 1 (Trưởng nhóm):** Xây dựng nền tảng, thiết kế CSDL PostgreSQL, kiến trúc hệ thống xác thực JWT (Luồng 1), quản lý không gian làm việc Workspace (Luồng 2) và lõi mã hóa bảo mật AES-256-GCM cho API Key (Luồng 3).
- **Thành viên 2:** Thiết kế kỹ thuật Prompt cho Gemini AI, xây dựng n8n workflow phân tích yêu cầu (Luồng 4), lập trình component trực quan hóa cây phân cấp Epic $\rightarrow$ Story $\rightarrow$ Task (Luồng 5) và các chức năng chỉnh sửa tương tác, khóa bản nháp (Luồng 6).
- **Thành viên 3:** Lập trình module giao tiếp Jira Cloud REST API v3, thuật toán ánh xạ cây phân cấp Top-Down (Luồng 7), tích hợp API lấy thành viên dự án Jira (Luồng 8) và xây dựng bộ lắng nghe Webhook đồng bộ trạng thái hai chiều có cơ chế Upsert chống trùng (Luồng 9).
- **Thành viên 4:** Lập trình Dashboard tổng hợp chỉ số KPI và biểu đồ tiến độ thời gian thực (Luồng 10), thiết kế kiến trúc thông báo đa kênh chống spam (Luồng 11), và xây dựng bộ máy xuất tài liệu kỹ thuật PDF/Markdown chuẩn tiếng Việt Unicode UTF-8 (Luồng 12).
