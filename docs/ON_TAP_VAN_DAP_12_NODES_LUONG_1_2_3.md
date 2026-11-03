**TÀI LIỆU ÔN TẬP VẤN ĐÁP: 12 NODE N8N CHO 3 LUỒNG NỀN TẢNG**  
**DỰ ÁN: AI JIRA AGENT (HỆ THỐNG PHÂN TÁCH YÊU CẦU & QUẢN LÝ JIRA TỰ ĐỘNG)**  
***Mục tiêu:*** *Giúp sinh viên hiểu rõ nhiệm vụ, dữ liệu và cách vận hành của* ***đúng 12 node trong từng workflow n8n*** *để tự tin trả lời vấn đáp trực tiếp với giảng viên. Ngắn gọn, súc tích, dễ nhớ, không lan man lý thuyết code!*  
  
---  
**MỤC LỤC**  
1. [Khái niệm cốt lõi cần nhớ trước khi vấn đáp](#anchor-1 "#anchor-1")  
2. [Luồng 1: Xác nhận đăng ký & Gửi email chào mừng (Flow 1)](#anchor-2 "#anchor-2")  
3. [Luồng 2: Quản lý & Kiểm toán Workspace (Flow 2)](#anchor-3 "#anchor-3")  
4. [Luồng 3: Quản lý Kho khóa Jira & AI API Key (Flow 3)](#anchor-4 "#anchor-4")  
5. [Bí kíp trình bày trước hội đồng trong 2 phút](#anchor-5 "#anchor-5")  
  
---  
**KHÁI NIỆM CỐT LÕI CẦN NHỚ TRƯỚC KHI VẤN ĐÁP**  
Trước khi bước vào từng node, hãy nhớ **3 nguyên tắc vàng** này:  
1. **Backend làm CRUD trước, n8n chạy tự động hóa sau:**  
   
 Mọi dữ liệu (tạo user, tạo workspace, lưu cấu hình) đều được Backend Express kiểm tra và lưu an toàn vào PostgreSQL **trước**. Sau khi lưu xong, Backend mới gửi HTTP POST sang Webhook của n8n.  
2. **n8n KHÔNG kết nối trực tiếp PostgreSQL:**  
   
 Trong cả 3 luồng, n8n không có node database nào. n8n đóng vai trò là "bộ máy tự động hóa ngoài biên" để gửi email và ghi nhận kiểm toán (audit).  
3. **Các loại node cơ bản trong n8n:**  
  - **Webhook:** Cổng đón nhận dữ liệu từ Backend gửi sang.  
  - **Set (Edit Fields):** Chuẩn hóa, bóc tách và gán giá trị mặc định cho dữ liệu.  
  - **IF:** Rẽ 2 nhánh nhị phân (Đúng đi nhánh True, Sai đi nhánh False).  
  - **Switch:** Rẽ nhiều nhánh dựa trên giá trị của trường (như ngã ba, ngã tư).  
  - **Merge:** Gom các nhánh xử lý riêng lẻ về lại một dòng duy nhất.  
  - **Respond to Webhook:** Trả kết quả (HTTP 200 hoặc 400) về cho Backend đang đợi.  
  
---  
**LUỒNG 1: XÁC NHẬN ĐĂNG KÝ & GỬI EMAIL CHÀO MỪNG**  
**File workflow thực tế:** `n8n/workflows/flow-1-auth-registration.json`  
**Sơ đồ luồng chạy (12 Node)**  
```  
flowchart LR  
     N1["Node 1: Webhook Trigger"] --> N2["Node 2: Normalize Event Data"]  
     N2 --> N3{"Node 3: IF Event & Required"}  
       
     N3 -->|True: Đúng REGISTER_SUCCESS| N4{"Node 4: IF Email & Timestamp"}  
     N3 -->|False: Sai Type / Thiếu trường| N9["Node 9: Prepare Invalid Error"]  
       
     N4 -->|True: Email hợp lệ| N5["Node 5: Prepare Email Content"]  
     N4 -->|False: Email sai regex| N9  
       
     N5 --> N6["Node 6: Send Email via SMTP"]  
     N6 --> N7["Node 7: Prepare Success Response"]  
     N7 --> N8["Node 8: Respond Success 200"]  
       
     N9 --> N10["Node 10: Respond Invalid Input 400"]  
       
     subgraph ErrorBranch["Nhánh bắt lỗi sự cố (Exception)"]  
         N11["Node 11: Error Trigger"] --> N12["Node 12: Sanitize & Format Error Log"]  
     end  
   
```  
  
---  
**Chi tiết 12 Node trong Flow 1Hãy rút gọn tài liệu HUONG_DAN_CHI_TIET_LUONG_1_2_3.md thành tài liệu hướng dẫn vấn đáp dễ hiểu cho sinh viên mới học.**  
   
**MỤC TIÊU:**  
**Tôi chỉ cần hiểu rõ 12 step/node của từng luồng n8n để giải thích được với giảng viên, không cần phân tích quá sâu từng dòng code.**  
   
**YÊU CẦU:**  
   
**1. Tập trung vào đúng 3 luồng:**  
**- Luồng 1: Đăng ký, đăng nhập và xác thực tài khoản.**  
**- Luồng 2: Quản lý Workspace.**  
**- Luồng 3: Cấu hình Jira và AI API Key.**  
   
**2. Mỗi luồng phải trình bày đầy đủ 12 step/node theo đúng thứ tự và tên trong workflow JSON thực tế của dự án. Không tự đặt tên node, không bỏ qua node và không tự sửa logic của workflow.**  
   
**3. Với mỗi node, giải thích theo mẫu:**  
   
**NODE 1 - Tên node**  
**- Chức năng: Node này làm nhiệm vụ gì?**  
**- Dữ liệu: Nhận dữ liệu gì và lấy từ đâu?**  
**- Xử lý: Nó kiểm tra hoặc thực hiện điều gì?**  
**- Tiếp theo: Dữ liệu đi đến node nào?**  
   
**Chỉ giải thích ngắn gọn, dùng từ ngữ dễ hiểu và ví dụ thực tế.**  
   
**4. Tập trung giải thích kỹ hơn ở những phần quan trọng:**  
**- Webhook nhận dữ liệu từ Backend như thế nào.**  
**- Node Set dùng để làm gì.**  
**- Node IF kiểm tra điều kiện gì, nhánh True và False đi đâu.**  
**- Node Switch chia dữ liệu thành những nhánh nào.**  
**- Node Merge kết hợp dữ liệu như thế nào.**  
**- Node gửi email hoặc gọi dịch vụ bên ngoài hoạt động ra sao.**  
**- Node xử lý lỗi hoạt động thế nào.**  
**- Node cuối trả kết quả gì.**  
   
**5. Với mỗi luồng, bổ sung:**  
**- Một ví dụ thực tế từ đầu đến cuối.**  
**- Sơ đồ ngắn gọn thể hiện thứ tự chạy và các nhánh.**  
**- Khoảng 5–8 câu hỏi vấn đáp có thể gặp, kèm câu trả lời ngắn, dễ nhớ.**  
**- Một đoạn tóm tắt để tôi có thể tự trình bày luồng đó trong khoảng 1–2 phút.**  
   
**6. Những phần KHÔNG cần trình bày dài:**  
**- Giải thích từng dòng code React hoặc Backend.**  
**- Các câu lệnh SQL chi tiết.**  
**- Công thức mã hóa, cấu trúc JWT và kiến thức lý thuyết không trực tiếp liên quan đến 12 node.**  
**- Các thuật ngữ kỹ thuật không cần thiết.**  
   
**7. LƯU Ý QUAN TRỌNG:**  
**- Phải đọc workflow JSON thực tế trước khi giải thích.**  
**- Phân biệt rõ node thuộc workflow chính và node xử lý lỗi riêng.**  
**- Không khẳng định node đã gửi email, kết nối Jira hoặc gọi AI thành công nếu chưa có bằng chứng từ cấu hình và kết quả thực thi.**  
**- Nếu tài liệu hiện tại mô tả khác với code thực tế, hãy chỉ rõ sự khác biệt, không tự đoán.**  
**- Không tự ý thay đổi code hoặc workflow của dự án.**  
**- Không thêm kiến thức dài dòng ngoài phạm vi cần học vấn đáp.**  
   
**Hãy viết lại thành một tài liệu Markdown mới, ngắn gọn, dễ đọc, dễ học và dễ ôn tập. Giữ nguyên tài liệu cũ, không ghi đè lên file gốc.**  
   
**Thứ tự thực hiện:**  
**1. Luồng 1 - giải thích đủ 12 node.**  
**2. Luồng 2 - giải thích đủ 12 node.**  
**3. Luồng 3 - giải thích đủ 12 node.**  
   
**Ưu tiên giúp tôi HIỂU NODE LÀM GÌ, TẠI SAO CẦN NODE ĐÓ VÀ DỮ LIỆU ĐI ĐÂU, thay vì bắt tôi học thuộc code.**  
***NODE 1 - Node 1 - Webhook Trigger***  
- **Chức năng:** Cổng tiếp nhận sự kiện đăng ký thành công do Backend Express gửi sang.  
- **Dữ liệu:** Nhận gói tin JSON qua HTTP POST tại đường dẫn `/auth-registration` từ hàm `AuthNotificationService.sendRegistrationConfirmation()` ở Backend.  
- **Xử lý:** Lắng nghe và giữ kết nối (`responseMode: responseNode`), đợi các node phía sau xử lý xong mới trả lời.  
- **Tiếp theo:** Chuyển dữ liệu sang **Node 2**.  
***NODE 2 - Node 2 - Normalize Event Data***  
- **Chức năng:** Chuẩn hóa dữ liệu đầu vào, tránh lỗi thiếu trường.  
- **Dữ liệu:** Lấy dữ liệu thô từ Node 1.  
- **Xử lý:** Dùng node `Set` bóc tách các trường: `eventType`, `userId`, `email` (cắt khoảng trắng và chuyển chữ thường), `displayName`, `registeredAt` và nội dung `emailTemplate`.  
- **Tiếp theo:** Chuyển sang **Node 3**.  
***NODE 3 - Node 3 - Check Event Type & Required Fields***  
- **Chức năng:** Kiểm tra điều kiện tầng 1 xem sự kiện có đúng là đăng ký mới hay không.  
- **Dữ liệu:** Lấy dữ liệu đã chuẩn hóa từ Node 2.  
- **Xử lý:** Kiểm tra 3 điều kiện đồng thời (AND):  
  1. `eventType` phải bằng `"REGISTER_SUCCESS"`  
  2. `userId` không được rỗng  
  3. `email` không được rỗng  
- **Tiếp theo:**  
  - **Nhánh True (Đạt):** Đi sang **Node 4**.  
  - **Nhánh False (Sai):** Đi sang **Node 9** (Báo lỗi 400).  
***NODE 4 - Node 4 - Check Email & Timestamp Format***  
- **Chức năng:** Kiểm tra điều kiện tầng 2 về định dạng email và thời gian.  
- **Dữ liệu:** Nhận dữ liệu từ nhánh True của Node 3.  
- **Xử lý:** Kiểm tra 2 điều kiện (AND):  
  1. `email` phải khớp biểu thức Regex email chuẩn (`^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$`).  
  2. `registeredAt` không được để trống.  
- **Tiếp theo:**  
  - **Nhánh True (Hợp lệ):** Đi sang **Node 5**.  
  - **Nhánh False (Sai định dạng):** Đi sang **Node 9** (Báo lỗi 400).  
***NODE 5 - Node 5 - Prepare Email Content***  
- **Chức năng:** Soạn sẵn nội dung email gửi cho người dùng.  
- **Dữ liệu:** Nhận thông tin user từ nhánh True của Node 4.  
- **Xử lý:** Dùng node `Set` gán `emailTo`, `fromEmail`, `emailSubject`, nội dung HTML (`emailHtml`) và Text (`emailText`) bằng tiếng Việt chuyên nghiệp.  
- **Tiếp theo:** Chuyển sang **Node 6**.  
***NODE 6 - Node 6 - Send Email via SMTP***  
- **Chức năng:** Kết nối máy chủ gửi thư điện tử và phát email thật tới hòm thư người dùng.  
- **Dữ liệu:** Nhận tiêu đề, người nhận và nội dung HTML từ Node 5.  
- **Xử lý:** Dùng node `emailSend` gọi tài khoản SMTP (Gmail App Password) đã được cấu hình bí mật trong n8n để chuyển thư đi.  
- **Tiếp theo:** Chuyển sang **Node 7**.  
***NODE 7 - Node 7 - Prepare Success Response***  
- **Chức năng:** Đóng gói kết quả báo hiệu gửi mail thành công.  
- **Dữ liệu:** Lấy trạng thái từ Node 6, đồng thời dùng biểu thức tham chiếu chéo `$('Node 2 - Normalize Event Data').item.json.userId` để lấy lại `userId` và `email` nguyên gốc từ Node 2.  
- **Xử lý:** Tạo object JSON: `{ success: true, statusCode: 200, emailSent: true, message: "Xác nhận đăng ký tài khoản AI Jira Agent thành công" }`.  
- **Tiếp theo:** Chuyển sang **Node 8**.  
***NODE 8 - Node 8 - Respond Success 200***  
- **Chức năng:** Bắn phản hồi HTTP 200 OK về cho Backend Express.  
- **Dữ liệu:** Nhận gói tin JSON thành công từ Node 7.  
- **Xử lý:** Trả response HTTP status 200, thông báo Backend rằng n8n đã hoàn thành việc gửi email xác nhận.  
- **Tiếp theo: Kết thúc** nhánh thành công của workflow.  
***NODE 9 - Node 9 - Prepare Invalid Input Error***  
- **Chức năng:** Chuẩn bị nội dung báo lỗi khi dữ liệu đầu vào không hợp lệ.  
- **Dữ liệu:** Nhận tín hiệu từ nhánh False của Node 3 hoặc Node 4.  
- **Xử lý:** Dùng node `Set` tạo JSON lỗi: `{ success: false, statusCode: 400, error: "Dữ liệu đăng ký không hợp lệ...", emailSent: false }`.  
- **Tiếp theo:** Chuyển sang **Node 10**.  
***NODE 10 - Node 10 - Respond Invalid Input 400***  
- **Chức năng:** Trả mã lỗi HTTP 400 về cho Backend.  
- **Dữ liệu:** Nhận JSON lỗi từ Node 9.  
- **Xử lý:** Bắn HTTP status 400 về cho caller.  
- **Tiếp theo: Kết thúc** nhánh lỗi dữ liệu của workflow.  
***NODE 11 - Node 11 - Error Trigger***  
- **Chức năng:** "Lưới hứng lỗi" toàn cục (Global Exception Handler) của riêng Flow 1.  
- **Dữ liệu:** Đứng độc lập, tự động nhận sự cố runtime khi bất kỳ node nào trong luồng chính bị sập (ví dụ: Node 6 gọi SMTP bị lỗi mạng hoặc sai mật khẩu email).  
- **Xử lý:** Bắt lấy thông báo lỗi ngoại lệ để ngăn workflow bị treo.  
- **Tiếp theo:** Chuyển sang **Node 12**.  
***NODE 12 - Node 12 - Sanitize & Format Error Log***  
- **Chức năng:** Làm sạch thông tin lỗi và ghi nhận log an toàn.  
- **Dữ liệu:** Lấy chi tiết lỗi từ Node 11.  
- **Xử lý:** Lọc sạch mọi dữ liệu nhạy cảm, gán cờ `sanitized: true` kèm ghi chú: *"Tuyệt đối không lưu mật khẩu, password hash, JWT token hoặc API secret trong log lỗi"*.  
- **Tiếp theo: Kết thúc** nhánh bắt lỗi runtime.  
  
---  
**Ví dụ chạy thực tế Flow 1**  
1. Bạn đăng ký tài khoản `student@example.com` trên màn hình React.  
2. Backend băm mật khẩu Bcrypt và lưu vào bảng `users` trong PostgreSQL.  
3. Backend phát sự kiện `REGISTER_SUCCESS` sang **Node 1** của n8n.  
4. **Node 2** chuẩn hóa email thành chữ thường \rightarrow**Node 3** kiểm tra đúng event \rightarrow**Node 4** kiểm tra đúng cấu trúc email \rightarrow**Node 5** tạo thư chào mừng tiếng Việt \rightarrow**Node 6** gửi mail qua SMTP \rightarrow**Node 7 & 8** báo thành công 200 về Backend.  
5. Người dùng nhận được email chào mừng trong hộp thư Gmail.  
  
---  
**Câu hỏi vấn đáp thường gặp (Flow 1)**  
**Q1: Node 6 (Send Email via SMTP) dùng tài khoản gì để gửi thư?**  
   
 *Trả lời:* Dùng tài khoản SMTP (như Gmail kèm App Password 16 ký tự) được cấu hình trong mục Credentials an toàn của n8n, không bị lộ ra code.  
**Q2: Nếu n8n bị tắt hoặc Node 6 gửi mail thất bại thì tài khoản có tạo được không?**  
   
 *Trả lời:* Dạ vẫn tạo được bình thường. Backend lưu user vào PostgreSQL trước khi gọi n8n và bọc lệnh gọi trong `try/catch`. Lỗi gửi mail không ảnh hưởng tới việc lưu database.  
**Q3: Node 11 (Error Trigger) khác gì so với Node 9 (Prepare Invalid Input)?**  
   
 *Trả lời:* Node 9 bắt lỗi logic do dữ liệu đầu vào sai (đi từ nhánh False của IF). Còn Node 11 là bắt ngoại lệ kỹ thuật runtime (ví dụ mất mạng, sập SMTP) khi workflow đang chạy.  
**Q4: Tại sao Node 7 lại dùng cú pháp `$('Node 2...').item.json.userId`?**  
   
 *Trả lời:* Đây là cú pháp Cross-node Reference (tham chiếu chéo) của n8n, giúp Node 7 lấy lại chính xác `userId` từ Node 2 mà không sợ bị Node 6 gửi mail làm biến mất dữ liệu.  
**Q5: Quên mật khẩu và gửi OTP có chạy qua workflow này không?**  
   
 *Trả lời:* Dạ không. Mã OTP 6 số được gửi trực tiếp từ Backend bằng thư viện Nodemailer để đảm bảo độ trễ thấp nhất và bảo mật tuyệt đối, không đi qua n8n.  
  
---  
**Đoạn nói mẫu 1-2 phút trình bày Luồng 1**  
*"Thưa thầy cô, Luồng 1 là quy trình xác nhận đăng ký tài khoản. Khi người dùng đăng ký tại giao diện React, Backend lưu tài khoản vào PostgreSQL xong sẽ gửi sự kiện sang n8n qua* ***Node 1 (Webhook Trigger)****. Tiếp đó,* ***Node 2*** *chuẩn hóa dữ liệu, đưa qua hai chốt kiểm tra là* ***Node 3 và Node 4 (IF)*** *để xác nhận đúng sự kiện `REGISTER_SUCCESS` và email hợp lệ. Nếu dữ liệu sai, nó rẽ nhánh sang* ***Node 9 và 10*** *trả lỗi 400. Nếu dữ liệu đúng,* ***Node 5*** *chuẩn bị mẫu thư HTML tiếng Việt,* ***Node 6*** *kết nối SMTP gửi thư chào mừng thật tới hòm thư người dùng, và* ***Node 7, Node 8*** *trả kết quả 200 OK về Backend. Workflow còn có* ***Node 11 và 12 (Error Trigger)*** *độc lập để hứng lỗi ngoại lệ và lọc sạch thông tin nhạy cảm trước khi ghi log."*  
  
---  
**LUỒNG 2: QUẢN LÝ & KIỂM TOÁN WORKSPACE**  
**File workflow thực tế:** `n8n/workflows/flow-2-workspace-management.json`  
**Sơ đồ luồng chạy (12 Node)**  
```  
flowchart TD  
     N1["Node 1: Webhook Trigger"] --> N2["Node 2: Normalize Event Input"]  
     N2 --> N3{"Node 3: Validate Event Type (IF)"}  
       
     N3 -->|Hợp lệ| N4{"Node 4: Route by Event Type (Switch)"}  
     N3 -->|Sai| Stop1[Dừng]  
       
     N4 -->|Nhánh 0: Mutations| N5{"Node 5: Validate Mutation Fields (IF)"}  
     N4 -->|Nhánh 1: Views| N7["Node 7: Process View Event (Set)"]  
     N4 -->|Nhánh 2: Deletions| N8["Node 8: Process Delete Event (Set)"]  
       
     N5 -->|True| N6["Node 6: Process Mutation Event (Set)"]  
     N5 -->|False| Stop2[Dừng]  
       
     N6 -->|Input 0| N9["Node 9: Merge Event Streams (Append)"]  
     N7 -->|Input 1| N9  
     N8 -->|Input 2| N9  
       
     N9 --> N10{"Node 10: Check Normalized Data (IF)"}  
     N10 -->|True| N11["Node 11: Generate Response Payload (Set)"]  
     N11 --> N12["Node 12: Respond to Webhook"]  
   
```  
  
---  
**Chi tiết 12 Node trong Flow 2**  
***NODE 1 - Node 1 - Webhook Trigger***  
- **Chức năng:** Cổng tiếp nhận các sự kiện quản lý Workspace (Tạo, Sửa, Xóa, Xem) từ Backend.  
- **Dữ liệu:** Nhận HTTP POST tại đường dẫn `/workspace-management` từ `WorkspaceEventService.emitEvent()` ở Backend.  
- **Xử lý:** Lắng nghe và giữ kết nối (`responseMode: responseNode`).  
- **Tiếp theo:** Chuyển sang **Node 2**.  
***NODE 2 - Node 2 - Normalize Event Input***  
- **Chức năng:** Chuẩn hóa dữ liệu sự kiện Workspace.  
- **Dữ liệu:** Lấy từ Node 1.  
- **Xử lý:** Bóc tách: `eventType`, `userId`, `workspaceId`, `workspaceName`, `description`, `timestamp` và tự động sinh mã `requestId` nếu thiếu.  
- **Tiếp theo:** Chuyển sang **Node 3**.  
***NODE 3 - Node 3 - Validate Event Type***  
- **Chức năng:** Kiểm tra xem sự kiện có thuộc 4 thao tác CRUD Workspace cho phép hay không.  
- **Dữ liệu:** Dữ liệu chuẩn hóa từ Node 2.  
- **Xử lý:** Dùng node `IF` với Regex kiểm tra: `eventType` phải là `WORKSPACE_CREATED`, `WORKSPACE_UPDATED`, `WORKSPACE_DELETED` hoặc `WORKSPACE_VIEWED` VÀ `userId` không được rỗng.  
- **Tiếp theo:** Nhánh True chuyển sang **Node 4**.  
***NODE 4 - Node 4 - Route by Event Type***  
- **Chức năng:** "Ngã ba đường" phân chia luồng xử lý theo đúng loại sự kiện.  
- **Dữ liệu:** Nhận dữ liệu từ Node 3.  
- **Xử lý:** Dùng node `Switch` chia thành **3 nhánh ra (Outputs)**:  
  - **Output 0 (`Mutations`):** Nếu là sự kiện Tạo hoặc Sửa (`WORKSPACE_CREATED` / `WORKSPACE_UPDATED`).  
  - **Output 1 (`Views`):** Nếu là sự kiện Xem dự án (`WORKSPACE_VIEWED`).  
  - **Output 2 (`Deletions`):** Nếu là sự kiện Xóa dự án (`WORKSPACE_DELETED`).  
- **Tiếp theo:**  
  - Nhánh 0 đi sang **Node 5**.  
  - Nhánh 1 đi sang **Node 7**.  
  - Nhánh 2 đi sang **Node 8**.  
***NODE 5 - Node 5 - Validate Mutation Fields***  
- **Chức năng:** Kiểm tra dữ liệu bắt buộc của thao tác Tạo/Sửa.  
- **Dữ liệu:** Nhận từ nhánh 0 của Node 4.  
- **Xử lý:** Node `IF` kiểm tra: `workspaceName` không được để trống VÀ `userId` không được để trống.  
- **Tiếp theo:** Nhánh True đi tiếp sang **Node 6**.  
***NODE 6 - Node 6 - Process Mutation Event***  
- **Chức năng:** Soạn nội dung kiểm toán (audit log) cho việc Tạo hoặc Cập nhật dự án.  
- **Dữ liệu:** Nhận từ Node 5.  
- **Xử lý:** Gán `category: "WORKSPACE_MUTATION"`, `status: "PROCESSED"` và tạo chuỗi tóm tắt:  
 `auditSummary = "Workspace được tạo/cập nhật thành công: [Tên Workspace]"`.  
- **Tiếp theo:** Chuyển vào **Cổng 0 (Input 0)** của **Node 9**.  
***NODE 7 - Node 7 - Process View Event***  
- **Chức năng:** Soạn nội dung kiểm toán cho thao tác Xem danh sách hoặc chi tiết dự án.  
- **Dữ liệu:** Nhận từ nhánh 1 của Node 4.  
- **Xử lý:** Gán `category: "WORKSPACE_QUERY"`, `status: "PROCESSED"` và tạo `auditSummary = "Người dùng truy vấn xem Danh sách Workspaces / Chi tiết ID..."`.  
- **Tiếp theo:** Chuyển vào **Cổng 1 (Input 1)** của **Node 9**.  
***NODE 8 - Node 8 - Process Delete Event***  
- **Chức năng:** Soạn nội dung kiểm toán cho thao tác Xóa dự án.  
- **Dữ liệu:** Nhận từ nhánh 2 của Node 4.  
- **Xử lý:** Gán `category: "WORKSPACE_DELETION"`, `status: "PROCESSED"` và tạo `auditSummary = "Workspace đã được xóa an toàn khỏi hệ thống: [Tên Workspace]"`.  
- **Tiếp theo:** Chuyển vào **Cổng 2 (Input 2)** của **Node 9**.  
***NODE 9 - Node 9 - Merge Event Streams***  
- **Chức năng:** Gom 3 nhánh xử lý (Node 6, 7, 8) về lại thành một luồng dữ liệu duy nhất.  
- **Dữ liệu:** Nhận từ 3 cổng Input (Input 0 từ Node 6, Input 1 từ Node 7, Input 2 từ Node 8).  
- **Xử lý:** Chế độ `mode: append` với 3 inputs. Node này không làm nghẽn luồng; hễ có dữ liệu từ bất kỳ nhánh nào tới là cho đi qua ngay.  
- **Tiếp theo:** Chuyển sang **Node 10**.  
***NODE 10 - Node 10 - Check Normalized Data***  
- **Chức năng:** Chốt chặn kiểm tra chất lượng dữ liệu lần cuối trước khi phản hồi.  
- **Dữ liệu:** Nhận dòng dữ liệu hợp nhất từ Node 9.  
- **Xử lý:** Node `IF` kiểm tra: `status == "PROCESSED"` VÀ `userId != ""`.  
- **Tiếp theo:** Nhánh True chuyển sang **Node 11**.  
***NODE 11 - Node 11 - Generate Response Payload***  
- **Chức năng:** Đóng gói JSON phản hồi hoàn chỉnh.  
- **Dữ liệu:** Nhận từ Node 10.  
- **Xử lý:** Gán các trường chuẩn: `success: true`, `workflowStatus: "COMPLETED"`, `message: "Xử lý sự kiện... thành công trong Flow 2"`, `processedAt: [Thời gian hiện tại]`.  
- **Tiếp theo:** Chuyển sang **Node 12**.  
***NODE 12 - Node 12 - Respond to Webhook***  
- **Chức năng:** Trả kết quả HTTP 200 kèm JSON về cho Backend Express.  
- **Dữ liệu:** Lấy từ Node 11.  
- **Xử lý:** Phản hồi HTTP 200 OK.  
- **Tiếp theo: Kết thúc** workflow Flow 2.  
  
---  
**Ví dụ chạy thực tế Flow 2**  
1. Bạn nhấn nút "Tạo dự án mới" trên giao diện React với tên *"Shopee Clone"*.  
2. Backend lưu dự án vào bảng `projects` trong PostgreSQL và cấp ID.  
3. Backend phát sự kiện `WORKSPACE_CREATED` sang **Node 1** của n8n.  
4. **Node 2** chuẩn hóa tên dự án \rightarrow**Node 3** kiểm tra đúng event \rightarrow**Node 4 (Switch)** đẩy dữ liệu sang nhánh Mutations \rightarrow**Node 5** kiểm tra có tên \rightarrow**Node 6** tạo dòng kiểm toán *"Workspace được tạo mới: Shopee Clone"*\rightarrow**Node 9 (Merge)** gom luồng \rightarrow**Node 10** kiểm tra trạng thái \rightarrow**Node 11** đóng gói JSON \rightarrow**Node 12** trả 200 về Backend.  
  
---  
**Câu hỏi vấn đáp thường gặp (Flow 2)**  
**Q1: Node 9 (Merge) có bắt buộc phải đợi cả 3 nhánh (Tạo, Xem, Xóa) cùng chạy xong không?**  
   
 *Trả lời:* Dạ không. Node 9 chạy ở chế độ `mode: append`. Mỗi lần người dùng thao tác chỉ kích hoạt duy nhất 1 nhánh của Switch, và khi nhánh đó tới Node 9 thì dữ liệu sẽ được cho đi tiếp ngay lập tức.  
**Q2: Workflow này có thực sự ghi log kiểm toán vào PostgreSQL không?**  
   
 *Trả lời:* Dạ không. Workflow này đóng vai trò điều phối và tạo chuỗi tóm tắt `auditSummary` trong bộ nhớ execution để phản hồi cho Backend. Việc lưu trữ dữ liệu bền vững của Workspace đã được Backend ghi vào PostgreSQL trước đó.  
**Q3: Tại sao lại cần Node 5 kiểm tra lại tên Workspace khi Node 3 đã kiểm tra rồi?**  
   
 *Trả lời:* Vì Node 3 chỉ kiểm tra xem sự kiện có thuộc 4 loại cho phép không. Còn thao tác Tạo/Sửa (Mutation) bắt buộc phải có tên Workspace, trong khi thao tác Xóa hay Xem danh sách có thể không cần tên Workspace.  
**Q4: Người dùng A có xem được Workspace của người dùng B không?**  
   
 *Trả lời:* Dạ không. Việc kiểm tra quyền sở hữu do Backend đảm nhiệm với điều kiện SQL `WHERE user_id = $userId`. n8n chỉ tiếp nhận sự kiện sau khi Backend đã xác thực thành công quyền sở hữu.  
  
---  
**Đoạn nói mẫu 1-2 phút trình bày Luồng 2**  
*"Thưa thầy cô, Luồng 2 là quy trình điều phối và kiểm toán sự kiện Workspace. Khi người dùng thực hiện thao tác CRUD trên giao diện, Backend lưu vào PostgreSQL rồi gửi sự kiện sang n8n qua* ***Node 1 (Webhook)****. Sau khi* ***Node 2*** *chuẩn hóa và* ***Node 3 (IF)*** *kiểm tra hợp lệ, điểm mấu chốt là* ***Node 4 (Switch)*** *sẽ phân chia thành 3 nhánh: Nhánh Tạo/Sửa đi qua* ***Node 5 & 6***, *Nhánh Xem đi qua* ***Node 7***, *và Nhánh Xóa đi qua* ***Node 8*** *để tạo ra các dòng tóm tắt kiểm toán `auditSummary` tương ứng. Sau đó,* ***Node 9 (Merge)*** *gom 3 nhánh về một luồng chung bằng chế độ append, chuyển qua* ***Node 10 & 11*** *kiểm tra và đóng gói payload, cuối cùng* ***Node 12 (Respond to Webhook)*** *trả mã 200 OK về Backend để kết thúc quy trình."*  
  
---  
**LUỒNG 3: CẤU HÌNH JIRA VÀ AI API KEY**  
**File workflow thực tế:** `n8n/workflows/flow-3-jira-ai-config.json` (kèm `flow-3-error-handler.json`)  
**Sơ đồ luồng chạy (12 Node)**  
```  
flowchart TD  
     N1["Node 1: Webhook Trigger"] --> N2["Node 2: Normalize Config Event"]  
     N2 --> N3{"Node 3: Validate Required Fields (IF)"}  
       
     N3 -->|Hợp lệ| N4{"Node 4: Route by Event Type (Switch)"}  
     N3 -->|Sai| Stop[Dừng]  
       
     N4 -->|Nhánh 0: Config Saved| N5{"Node 5: Validate Config Saved (IF)"}  
     N4 -->|Nhánh 1: Connection Test| N7{"Node 7: Validate Connection Test (IF)"}  
     N4 -->|Nhánh 2: Config Deleted| N9{"Node 9: Validate Config Deleted (IF)"}  
       
     N5 -->|True| N6["Node 6: Process Config Saved Event (Set)"]  
     N7 -->|True| N8["Node 8: Process Connection Test Event (Set)"]  
       
     N6 -->|Input 0| N10["Node 10: Merge Event Streams (Append)"]  
     N8 -->|Input 1| N10  
     N9 -->|True: Input 2| N10  
       
     N10 --> N11["Node 11: Generate Response Payload (Set)"]  
     N11 --> N12["Node 12: Respond to Webhook"]  
   
```  
  
---  
**Chi tiết 12 Node trong Flow 3**  
***NODE 1 - Node 1 - Webhook Trigger***  
- **Chức năng:** Cổng tiếp nhận sự kiện liên quan đến kho khóa bí mật (Lưu cấu hình, Test kết nối, Xóa cấu hình) từ Backend.  
- **Dữ liệu:** Nhận HTTP POST tại đường dẫn `/jira-ai-config` từ `ConfigEventService.emitEvent()` ở Backend.  
- **Xử lý:** Lắng nghe và giữ kết nối (`responseMode: responseNode`).  
- **Tiếp theo:** Chuyển sang **Node 2**.  
***NODE 2 - Node 2 - Normalize Config Event***  
- **Chức năng:** Chuẩn hóa metadata của sự kiện cấu hình.  
- **Dữ liệu:** Lấy từ Node 1.  
- **Xử lý:** Bóc tách: `eventType`, `userId`, `configId`, `provider` (viết hoa: `JIRA` hoặc `GEMINI`), `status`, `timestamp`, `requestId`.  
 *(Lưu ý: Payload gửi sang đây* ***tuyệt đối không có mật khẩu hay API Key***)*.*  
- **Tiếp theo:** Chuyển sang **Node 3**.  
***NODE 3 - Node 3 - Validate Required Fields***  
- **Chức năng:** Kiểm tra các trường bắt buộc của sự kiện cấu hình.  
- **Dữ liệu:** Dữ liệu chuẩn hóa từ Node 2.  
- **Xử lý:** Node `IF` kiểm tra:  
  1. `eventType` phải khớp với Regex: `^(CONFIG_SAVED|CONNECTION_TEST_REQUESTED|CONFIG_DELETED)$`.  
  2. `userId` và `requestId` không được rỗng.  
- **Tiếp theo:** Nhánh True đi tiếp sang **Node 4**.  
***NODE 4 - Node 4 - Route by Event Type***  
- **Chức năng:** Phân nhánh xử lý theo 3 hành động cấu hình khác nhau.  
- **Dữ liệu:** Nhận từ Node 3.  
- **Xử lý:** Node `Switch` chia thành **3 nhánh ra (Outputs)**:  
  - **Output 0 (`Config Saved`):** Nếu `eventType == 'CONFIG_SAVED'`.  
  - **Output 1 (`Connection Test`):** Nếu `eventType == 'CONNECTION_TEST_REQUESTED'`.  
  - **Output 2 (`Config Deleted`):** Nếu `eventType == 'CONFIG_DELETED'`.  
- **Tiếp theo:**  
  - Nhánh 0 sang **Node 5**.  
  - Nhánh 1 sang **Node 7**.  
  - Nhánh 2 sang **Node 9**.  
***NODE 5 - Node 5 - Validate Config Saved***  
- **Chức năng:** Kiểm tra tính hợp lệ của sự kiện lưu khóa.  
- **Dữ liệu:** Nhận từ nhánh 0 của Node 4.  
- **Xử lý:** Node `IF` kiểm tra: `provider` không được rỗng VÀ `status` phải là `SAVED`, `UPDATED` hoặc `SUCCESS`.  
- **Tiếp theo:** Nhánh True đi sang **Node 6**.  
***NODE 6 - Node 6 - Process Config Saved Event***  
- **Chức năng:** Tạo thông tin kiểm toán lưu kho khóa bảo mật.  
- **Dữ liệu:** Nhận từ Node 5.  
- **Xử lý:** Gán `category: "INTEGRATION_VAULT_SAVE"`, `status: "PROCESSED"` và tạo chuỗi:  
 `auditSummary = "Khóa bảo mật nhà cung cấp [JIRA/GEMINI] đã được mã hóa AES-256-GCM và lưu an toàn vào PostgreSQL"`.  
- **Tiếp theo:** Chuyển vào **Cổng 0 (Input 0)** của **Node 10**.  
***NODE 7 - Node 7 - Validate Connection Test***  
- **Chức năng:** Kiểm tra nhà cung cấp được yêu cầu test kết nối.  
- **Dữ liệu:** Nhận từ nhánh 1 của Node 4.  
- **Xử lý:** Node `IF` kiểm tra: `provider` phải là `JIRA` hoặc `GEMINI` VÀ `userId` không được để trống.  
- **Tiếp theo:** Nhánh True đi sang **Node 8**.  
***NODE 8 - Node 8 - Process Connection Test Event***  
- **Chức năng:** Ghi nhận sự kiện kiểm tra kết nối từ người dùng.  
- **Dữ liệu:** Nhận từ Node 7.  
- **Xử lý:** Gán `category: "INTEGRATION_TEST_EVENT"`, `status: "PROCESSED"` và ghi nhận:  
 `auditSummary = "Tiếp nhận sự kiện kiểm tra kết nối dịch vụ... (Kết quả kết nối thực tế do Backend thực thi an toàn)"`.  
- **Tiếp theo:** Chuyển vào **Cổng 1 (Input 1)** của **Node 10**.  
***NODE 9 - Node 9 - Validate Config Deleted***  
- **Chức năng:** Kiểm tra tính hợp lệ của sự kiện xóa khóa.  
- **Dữ liệu:** Nhận từ nhánh 2 của Node 4.  
- **Xử lý:** Node `IF` kiểm tra: `userId != ""` VÀ `eventType == "CONFIG_DELETED"`.  
- **Tiếp theo: Nối trực tiếp vào Cổng 2 (Input 2) của Node 10** (không cần node trung gian vì thao tác xóa không cần tạo dữ liệu vault).  
***NODE 10 - Node 10 - Merge Event Streams***  
- **Chức năng:** Hợp nhất 3 luồng xử lý cấu hình (Node 6, 8, 9) về một đầu ra duy nhất.  
- **Dữ liệu:** Nhận dữ liệu từ 3 cổng Input.  
- **Xử lý:** Chế độ `mode: append` với 3 inputs.  
- **Tiếp theo:** Chuyển sang **Node 11**.  
***NODE 11 - Node 11 - Generate Response Payload***  
- **Chức năng:** Đóng gói JSON phản hồi hoàn chỉnh cho sự kiện cấu hình.  
- **Dữ liệu:** Nhận từ Node 10.  
- **Xử lý:** Gán `success: true`, `workflowStatus: "COMPLETED"`, `message: "Xử lý sự kiện... thành công trong Flow 3"`, `processedAt: [Thời gian hiện tại]`.  
- **Tiếp theo:** Chuyển sang **Node 12**.  
***NODE 12 - Node 12 - Respond to Webhook***  
- **Chức năng:** Trả mã HTTP 200 OK kèm JSON về cho Backend Express.  
- **Dữ liệu:** Lấy từ Node 11.  
- **Xử lý:** Phản hồi HTTP 200 OK.  
- **Tiếp theo: Kết thúc** workflow Flow 3.  
  
---  
**Workflow phụ: Flow 3 Error Handler (**`flow-3-error-handler.json`**)**  
Dự án có riêng một file bắt lỗi độc lập cho Flow 3 gồm **2 nodes**:  
1. **Error Trigger:** Tự động kích hoạt khi workflow Flow 3 gặp lỗi ngoại lệ.  
2. **Format Error Response (Set):** Chuẩn hóa response trả về mã lỗi 400 kèm message: `"Yêu cầu không hợp lệ hoặc dữ liệu cấu hình thiếu trường bắt buộc."`.  
  
---  
**Ví dụ chạy thực tế Flow 3**  
1. Người dùng nhập Jira API Token vào màn hình Settings và bấm "Lưu".  
2. Backend mã hóa Token bằng thuật toán AES-256-GCM và lưu vào bảng `configurations`.  
3. Backend phát sự kiện `CONFIG_SAVED` (không kèm token) sang **Node 1** của n8n.  
4. **Node 2** chuẩn hóa provider = JIRA \rightarrow**Node 3** kiểm tra event \rightarrow**Node 4 (Switch)** rẽ nhánh Config Saved \rightarrow**Node 5** kiểm tra status \rightarrow**Node 6** tạo log *"Khóa bảo mật nhà cung cấp JIRA đã được mã hóa..."*\rightarrow**Node 10 (Merge)** gom luồng \rightarrow**Node 11 & 12** trả 200 về Backend.  
5. Giao diện React hiển thị thông báo thành công và che token thành `********Ab12` (Data Masking).  
  
---  
**Câu hỏi vấn đáp thường gặp (Flow 3)**  
**Q1: Node 8 (Process Connection Test Event) có thực sự gửi request sang Jira hay Google Gemini để kiểm tra kết nối không?**  
   
 *Trả lời:* **Dạ không.** Node 8 chỉ ghi nhận sự kiện người dùng bấm nút test. Việc kiểm tra kết nối mạng thật sự với Jira Cloud là do **Backend Express thực hiện** qua hàm `JiraService.getJiraProjects` bằng cách gửi request Basic Auth trực tiếp tới Atlassian.  
**Q2: Token của Jira và Gemini có đi qua các node của n8n không?**  
   
 *Trả lời:* Dạ không. Backend áp dụng nguyên tắc Zero-Trust, chỉ gửi metadata (`hasJiraDomain: true`, `isJiraConfigured: true`, `provider: 'JIRA'`) sang n8n. Toàn bộ chuỗi Token bí mật đều được mã hóa AES-256 nằm yên trong CSDL PostgreSQL.  
**Q3: Tại sao Node 9 (Validate Config Deleted) lại nối thẳng vào Node 10 (Merge) mà không qua một node xử lý riêng như Node 6 hay Node 8?**  
   
 *Trả lời:* Vì khi xóa cấu hình, Backend đã xóa dữ liệu trong DB rồi. n8n không cần sinh thêm dữ liệu kiểm toán mới mà chỉ cần xác nhận xóa hợp lệ rồi đi thẳng vào Merge để trả kết quả.  
**Q4: Data Masking là gì và tại sao lại cần thiết?**  
   
 *Trả lời:* Là cơ chế che dấu chuỗi bí mật, chỉ giữ lại 4 ký tự cuối (ví dụ `********a1b2`). Nhờ đó, người dùng biết mình đã cài đặt khóa mà không sợ bị lộ khóa nguyên văn trên màn hình trình duyệt.  
  
---  
**Đoạn nói mẫu 1-2 phút trình bày Luồng 3**  
*"Thưa thầy cô, Luồng 3 là quy trình quản lý sự kiện kho khóa tích hợp Jira và Gemini. Để đảm bảo an toàn, Backend mã hóa khóa bằng AES-256-GCM lưu vào PostgreSQL và chỉ gửi thông tin metadata không chứa khóa sang n8n qua* ***Node 1 (Webhook)****. Sau khi* ***Node 2*** *chuẩn hóa và* ***Node 3*** *xác thực trường,* ***Node 4 (Switch)*** *phân thành 3 nhánh: Nhánh Lưu khóa đi qua* ***Node 5 & 6***, *Nhánh Test kết nối đi qua* ***Node 7 & 8***, *và Nhánh Xóa khóa đi qua* ***Node 9***. *Sau đó,* ***Node 10 (Merge)*** *gom 3 nhánh về một luồng chung bằng mode append, đưa qua* ***Node 11*** *tạo payload và* ***Node 12 (Respond to Webhook)*** *trả mã 200 OK về Backend. Luồng này còn có file riêng `flow-3-error-handler.json` với Error Trigger để xử lý ngoại lệ an toàn."*  
  
---  
**BÍ KÍP TRÌNH BÀY TRƯỚC HỘI ĐỒNG TRONG 2 PHÚT**  
Nếu giảng viên yêu cầu: *"Em có 2 phút để tóm tắt kiến trúc 3 luồng em phụ trách"*, hãy tự tin nói theo 4 ý sau:  
1. **Về vai trò cá nhân:**  
 *"Em phụ trách 3 luồng nền tảng: Luồng 1 xác thực danh tính người dùng (Identity); Luồng 2 quản lý không gian làm việc nội bộ (Workspace); Luồng 3 quản lý kho lưu trữ khóa Jira và AI (Integration Vault)."*  
2. **Về phân chia trách nhiệm giữa Backend và n8n:**  
 *"Backend Express và PostgreSQL chịu trách nhiệm lưu trữ và bảo mật dữ liệu lõi trước. n8n không kết nối vào CSDL mà chỉ nhận Webhook từ Backend để chạy tự động hóa ngoài biên (Flow 1 gửi email chào mừng qua SMTP; Flow 2 và Flow 3 điều phối và kiểm toán sự kiện)."*  
3. **Về độ chịu lỗi (Fault Tolerance):**  
 *"Nếu máy chủ n8n bị tắt hoặc mất mạng, các thao tác đăng nhập, tạo dự án và lưu khóa của người dùng trên hệ thống vẫn diễn ra bình thường 100% nhờ cơ chế gọi bất đồng bộ non-blocking."*  
4. **Về cấu trúc 12 Node trong từng workflow:**  
 *"Cả 3 workflow n8n đều được thiết kế chuẩn mực gồm đúng 12 node khép kín: bắt đầu từ Webhook Trigger \rightarrow qua các node chuẩn hóa Set \rightarrow rẽ nhánh logic bằng IF/Switch \rightarrow gom luồng bằng Merge \rightarrow và kết thúc bằng Respond to Webhook để trả kết quả về Backend."*  
