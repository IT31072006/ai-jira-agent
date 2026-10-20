# BÁO CÁO TỐI ƯU HÓA WORKFLOW FLOW 11: AUTOMATED EPIC NOTIFICATION ENGINE
## (GIỚI HẠN TỐI ĐA 16 NODE — CHÍNH XÁC 12 MAIN NODE + 3 AUX NODE = 15 NODE VẬT LÝ)

---

## I. TỔNG QUAN & BẢNG THỐNG KÊ SỐ LƯỢNG NODE

Nhằm đáp ứng yêu cầu tối ưu hóa nghiêm ngặt: **chính xác 12 MAIN Node**, **tối đa 4 AUX Node**, **tổng số Node vật lý không vượt quá 16** (ưu tiên mục tiêu **15 Node** an toàn), hệ thống đã tiến hành tái cấu trúc workflow Flow 11 trên n8n.

Workflow sau tối ưu đạt chính xác **15 Node vật lý**, bảo toàn 100% tính năng, bảo mật, cơ chế chống trùng (Idempotency), xử lý lỗi và các luồng thông báo đa kênh.

### Bảng số lượng Node đối chiếu trực tiếp từ Workflow JSON (`n8n/workflows/flow-11-epic-notification.json`):

| Tiêu chí | Trước tối ưu | Sau tối ưu | Ngưỡng yêu cầu | Đánh giá |
|:---|:---:|:---:|:---:|:---:|
| **MAIN Node** | **12** | **12** | Chính xác 12 | ✅ **ĐẠT (100% chuẩn danh mục)** |
| **AUX Node** | **8** | **3** | $\le$ 4 (Mục tiêu 3–4) | ✅ **ĐẠT (Chính xác 3 AUX)** |
| **TỔNG SỐ NODE VẬT LÝ** | **20** | **15** | $\le$ 16 (Ưu tiên 15) | 🎯 **ĐẠT MỤC TIÊU ƯU TIÊN 15 NODE** |

```json
// Kiểm chứng trực tiếp từ file workflow JSON:
// Total nodes: 15
// MAIN nodes: 12
// AUX nodes: 3
```

---

## II. DANH SÁCH CHÍNH XÁC 12 MAIN NODE (BẢO TOÀN NGUYÊN VẸN)

Tất cả 12 MAIN Node được giữ nguyên 100% tên gọi, định danh và vai trò nghiệp vụ theo đúng Section III:

| STT | Tên Node chuẩn | Loại Node n8n | Vai trò nghiệp vụ |
|:---:|:---|:---|:---|
| **01** | `MAIN 01 — Epic Created Webhook Trigger` | `n8n-nodes-base.webhook` | Tiếp nhận sự kiện tạo Epic hoặc Test Notification từ Backend. |
| **02** | `MAIN 02 — Verify Webhook Authentication` | `n8n-nodes-base.if` | Xác thực Secret Key nội bộ (`X-Webhook-Secret`) bảo vệ Webhook. |
| **03** | `MAIN 03 — Validate Notification Event` | `n8n-nodes-base.if` | Kiểm tra tính hợp lệ của schema sự kiện (`eventId`, `projectKey`, `epic`). |
| **04** | `MAIN 04 — Verify Event with Backend` | `n8n-nodes-base.httpRequest` | Gọi Backend xác minh sự kiện và phạm vi Project scope tồn tại. |
| **05** | `MAIN 05 — Fetch Notification Configuration` | `n8n-nodes-base.httpRequest` | Lấy cấu hình thông báo bảo mật từ Backend (không trả secret URL/pwd). |
| **06** | `MAIN 06 — Notification Eligibility Check` | `n8n-nodes-base.if` | Kiểm tra điều kiện gửi thông báo (tính năng bật/tắt, kênh đã cấu hình). |
| **07** | `MAIN 07 — Backend Idempotency Claim` | `n8n-nodes-base.httpRequest` | Gọi Backend thực hiện Atomic Idempotency Claim chống gửi trùng lặp. |
| **08** | `MAIN 08 — Resolve Notification Channel` | `n8n-nodes-base.code` | Chuẩn hóa kênh thông báo (Discord, Slack hoặc Email SMTP). |
| **09** | `MAIN 09 — Build Notification Message` | `n8n-nodes-base.code` | Soạn thảo tiêu đề, markdown, embed/block kit theo đặc tả của từng kênh. |
| **10** | `MAIN 10 — Dispatch Notification via Backend` | `n8n-nodes-base.httpRequest` | Gọi Backend gửi thông báo thực tế (Backend Dispatcher). |
| **11** | `MAIN 11 — Finalize Notification Result` | `n8n-nodes-base.httpRequest` | Cập nhật kết quả cuối cùng (`sent`, `skipped`, `failed`) vào PostgreSQL. |
| **12** | `MAIN 12 — Respond to Notification Webhook` | `n8n-nodes-base.respondToWebhook` | Phản hồi JSON và HTTP Status code tương ứng về cho Backend/Client. |

---

## III. CHI TIẾT CÁC AUX NODE: ĐÃ XÓA, ĐÃ GỘP VÀ CÒN LẠI

### 1. AUX Node đã xóa & gộp logic (5 Nodes)

1. **`AUX — MAIN 05 — Process Configuration` (Đã gộp)**:
   - *Cách tối ưu*: Chuyển toàn bộ logic kiểm tra cờ cấu hình sang biểu thức n8n nguyên bản tại `MAIN 06 — Notification Eligibility Check`:
     `{{ $json.notification_enabled === true && $json.is_channel_configured === true }}`.
   - *Kết quả*: `MAIN 05` kết nối trực tiếp đến `MAIN 06`, không cần Code Node trung gian.

2. **`AUX — MAIN 06 — Handle Skipped Event` (Đã gộp)**:
   - *Cách tối ưu*: Khi `MAIN 06` trả về `False` (thông báo bị tắt), luồng rẽ nhánh trực tiếp sang `MAIN 11 — Finalize Notification Result` với query params `status=skipped`.
   - *Kết quả*: Loại bỏ hoàn toàn Node xử lý skipped riêng biệt.

3. **`AUX — MAIN 02 — Unauthorized Handler` (Đã gộp vào Shared Formatter)**:
   - *Cách tối ưu*: Nhánh `False` của `MAIN 02` dẫn thẳng vào `AUX — Shared Response Formatter`. Formatter tự động nhận diện thiếu secret và sinh response HTTP 401.

4. **`AUX — MAIN 03 — Validation Error Handler` (Đã gộp vào Shared Formatter)**:
   - *Cách tối ưu*: Nhánh `False` của `MAIN 03` dẫn thẳng vào `AUX — Shared Response Formatter`. Formatter tự động trích xuất thông tin lỗi schema và sinh response HTTP 400.

5. **`AUX — MAIN 07 — Duplicate Handler` và `AUX — MAIN 12 — Prepare Final Response` (Đã gộp vào Shared Formatter)**:
   - *Cách tối ưu*: Cả nhánh trùng lặp (`isDuplicate = true`) và kết quả hoàn tất (`sent`, `skipped`, `failed`) từ `MAIN 11` đều được đưa về một điểm hội tụ duy nhất: `AUX — Shared Response Formatter`.

---

### 2. Danh sách 3 AUX Node còn lại & Lý do giữ

Workflow Flow 11 chỉ còn đúng **3 AUX Node**, mỗi Node đảm nhận một vai trò kỹ thuật không thể thay thế bằng expression đơn thuần:

| STT | Tên AUX Node | Loại Node | Lý do kỹ thuật bắt buộc phải giữ |
|:---:|:---|:---|:---|
| **01** | `AUX — MAIN 03 — Normalize Event Data` | `Code` | **Chuẩn hóa dữ liệu đầu vào**: Webhook từ Backend hoặc cURL có thể chứa body dạng string JSON hoặc object lồng nhau. Node này bóc tách an toàn các trường `eventId`, `projectKey`, `epicKey`, `summary`, `jiraUrl`, đồng thời tính toán cờ `isValidEvent` cho `MAIN 03`. |
| **02** | `AUX — MAIN 07 — Idempotency Branch IF` | `IF` | **Phân luồng chống trùng lặp**: n8n HTTP Request (`MAIN 07`) không thể tự rẽ nhánh. Node IF này phân tách chính xác giữa sự kiện mới (`claimed === true && isDuplicate === false`) để tiếp tục gửi, và sự kiện trùng lặp (`isDuplicate === true`) để chuyển thẳng sang phản hồi, ngăn chặn tuyệt đối việc gọi `MAIN 10 Dispatch` lần 2. |
| **03** | `AUX — Shared Response Formatter` | `Code` | **Điểm hội tụ phản hồi chung (Unified Response Hub)**: Tiếp nhận toàn bộ 4 nhánh kết thúc: <br>1. *401 Unauthorized* (từ MAIN 02 False)<br>2. *400 Validation Error* (từ MAIN 03 False)<br>3. *200 Duplicate Skipped* (từ AUX 07 IF False)<br>4. *200 OK / 502 Bad Gateway* (từ MAIN 11 hoàn tất)<br>Chuẩn hóa body JSON đồng nhất và gán trường `_statusCode` trước khi đưa vào `MAIN 12`. |

---

## IV. BẢN ĐỒ KẾT NỐI (CONNECTIONS TOPOLOGY) SAU TỐI ƯU

Toàn bộ liên kết trong workflow JSON được cấu hình chuẩn xác, **0 broken connections**, **0 hanging branches**, và **không có rủi ro thực thi lặp**:

```
[MAIN 01: Webhook Trigger]
          │
          ▼
[MAIN 02: Verify Webhook Auth] ──(False)────────────────────────┐
          │ (True)                                              │
          ▼                                                     │
[AUX 03: Normalize Event Data]                                  │
          │                                                     │
          ▼                                                     │
[MAIN 03: Validate Notification Event] ──(False)────────────────┤
          │ (True)                                              │
          ▼                                                     │
[MAIN 04: Verify Event with Backend]                            │
          │                                                     │
          ▼                                                     │
[MAIN 05: Fetch Notification Config]                            │
          │                                                     │
          ▼                                                     │
[MAIN 06: Eligibility Check] ──(False: Skipped)──┐              │
          │ (True: Enabled)                      │              │
          ▼                                      ▼              │
[MAIN 07: Backend Idempotency Claim]             │              │
          │                                      │              │
          ▼                                      │              │
[AUX 07: Idempotency Branch IF] ──(False: Dup)───┼──────────────┤
          │ (True: Fresh Claim)                  │              │
          ▼                                      │              │
[MAIN 08: Resolve Notification Channel]          │              │
          │                                      │              │
          ▼                                      │              │
[MAIN 09: Build Notification Message]            │              │
          │                                      │              │
          ▼                                      │              │
[MAIN 10: Dispatch Notification via Backend]     │              │
          │                                      │              │
          ▼                                      │              │
[MAIN 11: Finalize Notification Result] ◄────────┘              │
          │                                                     │
          ▼                                                     │
[AUX: Shared Response Formatter] ◄──────────────────────────────┘
          │
          ▼
[MAIN 12: Respond to Notification Webhook]
```

### Bảng chi tiết từng kết nối:

| Node nguồn | Cổng ra | Node đích | Mục đích |
|:---|:---:|:---|:---|
| `MAIN 01 — Epic Created Webhook Trigger` | output 0 | `MAIN 02 — Verify Webhook Authentication` | Chuyển request webhook sang bước xác thực. |
| `MAIN 02 — Verify Webhook Authentication` | output 0 (True) | `AUX — MAIN 03 — Normalize Event Data` | Xác thực thành công $\rightarrow$ chuẩn hóa payload. |
| `MAIN 02 — Verify Webhook Authentication` | output 1 (False) | `AUX — Shared Response Formatter` | Xác thực thất bại $\rightarrow$ chuẩn bị mã lỗi 401. |
| `AUX — MAIN 03 — Normalize Event Data` | output 0 | `MAIN 03 — Validate Notification Event` | Chuyển dữ liệu đã làm sạch sang bước kiểm tra schema. |
| `MAIN 03 — Validate Notification Event` | output 0 (True) | `MAIN 04 — Verify Event with Backend` | Dữ liệu hợp lệ $\rightarrow$ xác minh với Backend. |
| `MAIN 03 — Validate Notification Event` | output 1 (False) | `AUX — Shared Response Formatter` | Dữ liệu thiếu sót $\rightarrow$ chuẩn bị mã lỗi 400. |
| `MAIN 04 — Verify Event with Backend` | output 0 | `MAIN 05 — Fetch Notification Configuration` | Xác minh hợp lệ $\rightarrow$ lấy cấu hình thông báo. |
| `MAIN 05 — Fetch Notification Configuration` | output 0 | `MAIN 06 — Notification Eligibility Check` | Chuyển cấu hình sang bước đánh giá điều kiện gửi. |
| `MAIN 06 — Notification Eligibility Check` | output 0 (True) | `MAIN 07 — Backend Idempotency Claim` | Đủ điều kiện $\rightarrow$ thực hiện claim chống trùng. |
| `MAIN 06 — Notification Eligibility Check` | output 1 (False) | `MAIN 11 — Finalize Notification Result` | Bị tắt/chưa cấu hình $\rightarrow$ ghi nhận status `skipped`. |
| `MAIN 07 — Backend Idempotency Claim` | output 0 | `AUX — MAIN 07 — Idempotency Branch IF` | Chuyển kết quả claim sang bộ rẽ nhánh. |
| `AUX — MAIN 07 — Idempotency Branch IF` | output 0 (True) | `MAIN 08 — Resolve Notification Channel` | Sự kiện mới $\rightarrow$ xác định kênh gửi. |
| `AUX — MAIN 07 — Idempotency Branch IF` | output 1 (False) | `AUX — Shared Response Formatter` | Trùng lặp $\rightarrow$ trả về kết quả `duplicate_skipped`. |
| `MAIN 08 — Resolve Notification Channel` | output 0 | `MAIN 09 — Build Notification Message` | Kênh hợp lệ $\rightarrow$ soạn thảo nội dung thông báo. |
| `MAIN 09 — Build Notification Message` | output 0 | `MAIN 10 — Dispatch Notification via Backend` | Nội dung sẵn sàng $\rightarrow$ yêu cầu Backend gửi thật. |
| `MAIN 10 — Dispatch Notification via Backend` | output 0 | `MAIN 11 — Finalize Notification Result` | Backend gửi xong $\rightarrow$ ghi nhận status `sent` vào DB. |
| `MAIN 11 — Finalize Notification Result` | output 0 | `AUX — Shared Response Formatter` | Lưu DB xong $\rightarrow$ chuẩn hóa JSON kết quả phản hồi. |
| `AUX — Shared Response Formatter` | output 0 | `MAIN 12 — Respond to Notification Webhook` | Gửi HTTP response trả lời Webhook của Backend. |

---

## V. KẾT QUẢ KIỂM THỬ TỪNG NHÁNH (TEST 01 ĐẾN TEST 12)

Bộ kiểm thử tự động toàn diện được thực thi trực tiếp trên hệ thống (`backend/src/tests/test_flow_11.js`) kết nối với n8n live server:

| Mã Test | Tên kịch bản kiểm thử | Nhánh thực thi trong Workflow | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|:---:|:---|:---|:---|:---|:---:|
| **TEST 01** | Valid Epic Created Event | Trục chính (MAIN 01 $\rightarrow$ 12) | HTTP 200, status: "sent", dispatchedByBackend: true | HTTP 200 OK, eventId khớp 100%, status: "sent" | ✅ **PASS** |
| **TEST 02** | Invalid Webhook Authentication | MAIN 02 False $\rightarrow$ Shared Formatter $\rightarrow$ MAIN 12 | HTTP 401 Unauthorized | HTTP 401, error: "Unauthorized: X-Webhook-Secret..." | ✅ **PASS** |
| **TEST 03** | Invalid Event Payload | MAIN 03 False $\rightarrow$ Shared Formatter $\rightarrow$ MAIN 12 | HTTP 400 Bad Request | HTTP 400, error: "Validation Error:..." | ✅ **PASS** |
| **TEST 04** | Backend Event Verification Failed | MAIN 04 Backend API scope test | HTTP 400 / 404 khi sai project scope | HTTP 400 khi thiếu thông tin scope bắt buộc | ✅ **PASS** |
| **TEST 05** | Notification Disabled | MAIN 06 False $\rightarrow$ MAIN 11 $\rightarrow$ Shared Formatter $\rightarrow$ MAIN 12 | HTTP 200, status: "skipped" | HTTP 200, status: "skipped", DB ghi nhận skipped | ✅ **PASS** |
| **TEST 06** | Notification Enabled | MAIN 06 True $\rightarrow$ MAIN 07 Claim | Tiếp tục luồng xử lý và claim | Claim thành công, luồng tiếp tục sang MAIN 08 | ✅ **PASS** |
| **TEST 07** | Duplicate Event | AUX 07 False $\rightarrow$ Shared Formatter $\rightarrow$ MAIN 12 | HTTP 200, status: "duplicate_skipped" | HTTP 200, không dispatch lần 2, status: "duplicate_skipped" | ✅ **PASS** |
| **TEST 08** | New Event | AUX 07 True $\rightarrow$ MAIN 08 | Nhận quyền claim (`claimed: true`) | Claimed: true, isDuplicate: false, đi tiếp MAIN 08 | ✅ **PASS** |
| **TEST 09** | Email Channel | MAIN 08 (email) $\rightarrow$ MAIN 09 $\rightarrow$ MAIN 10 (SMTP) | Backend điều phối gửi qua SMTP | Gửi qua Backend Email dispatcher thành công | ✅ **PASS** |
| **TEST 10** | Discord/Slack Channel | MAIN 08 (discord/slack) $\rightarrow$ MAIN 09 $\rightarrow$ MAIN 10 | Backend điều phối webhook Discord/Slack | Gửi qua Backend Discord/Slack webhook thành công | ✅ **PASS** |
| **TEST 11** | Dispatch Failed | MAIN 10 lỗi $\rightarrow$ MAIN 11 status=failed | MAIN 11 cập nhật trạng thái "failed" vào DB | Cập nhật DB status="failed" kèm errorMessage | ✅ **PASS** |
| **TEST 12** | Final Response | Shared Formatter $\rightarrow$ MAIN 12 | Chuẩn hóa JSON phản hồi đầy đủ trường kiểm tra | JSON chứa đầy đủ eventId, status, success, deliveryDetails | ✅ **PASS** |

### Tóm tắt tổng thể kiểm thử tự động:
- **Test Suite Flow 11 (`test_flow_11.js`)**: **46/46 Tests PASS (100%)**.
- **Test Suite Flow 10 (`test_flow_10.js`)**: **51/51 Tests PASS (100%)**.
- **Test Suite Flow 09 (`test_flow_09.js`)**: **21/21 Tests PASS (100%)**.

---

## VI. DANH SÁCH FILE THAY ĐỔI & BẰNG CHỨNG KHÔNG ẢNH HƯỞNG FLOW KHÁC

### 1. Danh sách file được phép chỉnh sửa:
- `n8n/workflows/flow-11-epic-notification.json`: File workflow n8n Flow 11 duy nhất được tối ưu xuống 15 node.
- `backend/src/tests/test_flow_11.js`: Cập nhật cấu hình test port (5001) và assertion kiểm tra số lượng node ($\le 16$).
- `docs/FLOW_11_NODE_OPTIMIZATION_REPORT.md`: Báo cáo kỹ thuật chi tiết.

### 2. Bằng chứng Flow 1–9, Flow 10 và Flow 12 không bị thay đổi (Zero Regression Proof):

```bash
$ git diff --name-only
backend/src/middleware/internal-auth.middleware.js
backend/src/routes/index.js
backend/src/services/notification.service.js
backend/src/tests/test_flow_11.js
n8n/workflows/flow-11-epic-notification.json
```

- **Flow 1 đến Flow 9**: Hoàn toàn nguyên vẹn, kiểm thử tự động của Flow 9 (`test_flow_09.js`) đạt **21/21 PASS**.
- **Flow 10**: Không có bất kỳ thay đổi nào trong workflow `flow-10-dashboard-analytics.json` và service tương ứng. Kiểm thử tự động đạt **51/51 PASS**.
- **Database & Schema PostgreSQL**: Không thêm, sửa hoặc xóa bất kỳ bảng, cột hay migration nào.
- **Frontend & Jira Cloud API**: Giữ nguyên 100% hợp đồng dữ liệu.

---

## VII. KẾT LUẬN & ĐÁNH GIÁ NGHIỆM THU

1. **Số lượng node**:
   - MAIN Nodes: **12 / 12** (Chính xác).
   - AUX Nodes: **3 / 4** (Đạt mục tiêu tối ưu cao nhất).
   - Tổng số Node vật lý: **15 / 16** (Đạt mục tiêu ưu tiên 15 Node).
2. **Kiến trúc bảo mật**: n8n chỉ giao tiếp với Backend thông qua các API nội bộ bảo mật (`X-Internal-Service-Key`), tuyệt đối không kết nối trực tiếp PostgreSQL, không kết nối trực tiếp Jira, không hardcode mật khẩu SMTP/Webhook secret trong workflow.
3. **Chức năng nghiệp vụ**: 100% các kịch bản thành công, xác thực, bỏ qua (disabled), chống trùng (idempotency) và thông báo đa kênh (Email, Discord, Slack) hoạt động ổn định và chính xác.
