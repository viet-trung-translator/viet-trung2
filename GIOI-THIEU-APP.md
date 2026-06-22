# Giới thiệu chi tiết — App "along 翻译"

## 1. Thể loại & mục đích
- **Tên:** along 翻译
- **Thể loại:** Ứng dụng web phiên dịch giọng nói **thời gian thực** Trung ↔ Việt, gồm 2 phần:
  1. **Gọi điện có phiên dịch** (2 người ở 2 nơi gọi nhau, mỗi người nghe tiếng của mình).
  2. **Dịch 1 máy** (2 người ngồi cạnh nhau, nói qua 1 điện thoại).
- **Chạy trên:** trình duyệt điện thoại/máy tính (Safari, Chrome…), **không cần cài đặt**, vào bằng đường link.
- **Dùng cho ai:** người Việt và người Trung cần nói chuyện mà không cùng ngôn ngữ — đặc biệt môi trường **công xưởng/nhà máy** (quản lý người Trung ↔ công nhân người Việt), thương mại, du lịch, đời sống.

## 2. "Bộ não" AI & công nghệ
- **AI dịch:** **Google Gemini 3.5 Live Translate** (`gemini-3.5-live-translate-preview`) — model dịch **giọng-sang-giọng** real-time, **giữ ngữ điệu & cảm xúc**, tự nhận diện ngôn ngữ, độ trễ thấp.
- **Cặp ngôn ngữ:** Trung ↔ Việt (đổi được qua cấu hình).
- **Công nghệ nền:**
  - Giao diện: React + Vite + TypeScript.
  - Máy chủ: Node.js + Fastify + WebSocket.
  - Cơ sở dữ liệu: PostgreSQL (Neon) — lưu tài khoản.
  - Đăng nhập: JWT + mật khẩu băm (bcrypt).
  - Âm thanh: Web Audio API (thu PCM 16kHz, phát PCM 24kHz).
  - Triển khai: Docker trên Render (1 dịch vụ, HTTPS).

## 3. Danh sách chức năng đầy đủ

### A. Tài khoản & phân quyền
- **Đăng ký:** tên đăng nhập + mật khẩu + chọn ngôn ngữ của mình (Tiếng Việt / Tiếng Trung).
- **Đăng nhập:** giữ phiên bằng token (không phải đăng nhập lại mỗi lần).
- **Tài khoản CHỦ (admin):** tài khoản **đăng ký đầu tiên** tự thành chủ.
- **Duyệt tài khoản:** người đăng ký sau ở trạng thái **chờ duyệt**, phải được chủ đồng ý mới đăng nhập được (kiểm soát ai được dùng — hợp để bán).

### B. Trang quản trị (chỉ CHỦ thấy)
- Xem danh sách toàn bộ tài khoản + trạng thái (chờ duyệt / đã duyệt / đã khóa).
- **Duyệt** tài khoản chờ.
- **Khóa** tài khoản (không cho đăng nhập).
- **Xóa** tài khoản.

### C. Trực tuyến (online) & danh bạ
- Thấy **ai đang online** theo thời gian thực.
- **Tìm người** theo tên để gọi.
- **Hay liên lạc:** danh sách người bạn **gọi nhiều nhất + gần đây nhất** (gồm cả người đang offline).
- Tự **kết nối lại** khi rớt mạng + "nhịp tim" giữ kết nối ổn định.

### D. Gọi điện có phiên dịch
- **Gọi** một người đang online → bên kia **đổ chuông** → **Nghe / Từ chối** → **Cúp máy**.
- Khi đang gọi: **dịch giọng nói real-time 2 chiều** — A nói tiếng Việt, B nghe tiếng Trung; B nói tiếng Trung, A nghe tiếng Việt.
- **Chữ trên màn hình:** "Bạn nói" (câu gốc của mình) + "Bản dịch" (lời bên kia dịch sang tiếng mình).
- **Nút Loa trong / Loa ngoài:** chỉnh âm lượng phát.
- **Chống lặp (bán song công):** khi đang phát bản dịch thì mic tạm ngắt → không bị vọng/lặp. **Cách dùng: nói theo lượt** (một người nói, ngừng, nghe bản dịch, rồi người kia nói).

### E. Dịch 1 máy (2 người 1 điện thoại)
- **1 nút micro:** bấm để bắt đầu/dừng.
- Nói **tiếng Việt → ra tiếng Trung**, nói **tiếng Trung → ra tiếng Việt** (tự nhận diện).
- **Đổi hướng theo lượt:** đang nói liên tục thì giữ nguyên; **ngừng ~1 giây** rồi nói tiếng kia thì tự đổi chiều dịch.
- Hiển thị **song ngữ:** ô "Bản gốc" + ô "Bản dịch".
- Chạy **liên tục** đến khi tắt; tự **làm mới phiên** mỗi ~14 phút (vượt giới hạn 15 phút của model).

### F. Giao diện song ngữ
- Người dùng tài khoản **tiếng Trung → toàn bộ giao diện tiếng Trung**; tiếng Việt → giao diện tiếng Việt.
- Màn hình đăng nhập có nút **VI / 中文** để chọn ngay.

### G. Thương hiệu
- Logo + tên **along 翻译**, biểu tượng (favicon), tiêu đề trình duyệt.

## 4. Cách dùng chi tiết (từng bước)

### Bước 1 — Chủ tạo tài khoản đầu tiên
1. Mở link app.
2. Bấm **Đăng ký** → nhập tên + mật khẩu → chọn ngôn ngữ của bạn → **Đăng ký**.
3. Vì là người đầu tiên → bạn thành **CHỦ**, đăng nhập được ngay.

### Bước 2 — Cấp tài khoản cho người dùng (khách)
1. Người dùng mới mở link → **Đăng ký** (chọn đúng ngôn ngữ họ muốn nghe: người Trung chọn Tiếng Trung).
2. Tài khoản đó **chờ duyệt**.
3. Bạn (chủ) → vào **Quản trị** → bấm **Duyệt**.
4. Người đó đăng nhập được.

### Bước 3 — Gọi điện phiên dịch
1. Hai người **cùng đăng nhập** và **cùng online**.
2. Mở trang chính → thấy người kia ở **Đang online** hoặc **Hay liên lạc**.
3. Bấm **📞 Gọi** → bên kia đổ chuông → **Nghe**.
4. **Nói theo lượt:** nói 1 câu → ngừng → nghe bản dịch bên kia phát xong → tới lượt người kia.
5. Đọc chữ trên màn hình (câu gốc + bản dịch). Xong bấm **Cúp máy**.

### Bước 4 — Dịch 1 máy (ngồi cạnh nhau)
1. Trang chính → bấm **🎤 Dùng chế độ dịch 1 máy**.
2. Bấm nút **🎤** → cho phép micro.
3. Người Việt nói → máy phát tiếng Trung; **ngừng ~1 giây**; người Trung nói → máy phát tiếng Việt.
4. Xong bấm nút dừng.
> Mẹo: chế độ 1 máy nên dùng **tai nghe** hoặc để loa nhỏ để mic không thu nhầm tiếng loa.

## 5. Giới hạn hiện tại (cần biết)
- **Máy chủ gói miễn phí (Render free):** "ngủ" sau ~15 phút không dùng → lần mở đầu chờ ~30–60 giây (hiện trang "đang khởi động"). Nâng gói trả phí (~$7/tháng) sẽ hết.
- **Loa ngoài phải nói theo lượt** (bán song công) để chống lặp. Muốn nói liên tục thì mỗi người **cắm tai nghe**.
- **Cả hai phải đang mở app** mới gọi được (chưa có chuông khi app đóng).
- Dịch chuyên ngành: dùng kiến thức sẵn của model; **chưa áp được "từ điển thuật ngữ riêng"** của công ty (model dịch chuyên dụng không nhận glossary).

## 6. Chưa có / dự kiến nâng cấp
- Đổi / quên mật khẩu; giới hạn thời lượng gọi mỗi tài khoản.
- Tính tiền / gói cước (để bán).
- Lịch sử cuộc gọi.
- **App cài đặt (App Store / CH Play)** + **chuông khi app đang đóng** (cần thông báo đẩy).
- Từ điển thuật ngữ công xưởng (lớp thay thế ổn định).
- Gọi nhóm / gọi video.

## 7. Thông tin kỹ thuật / vận hành
- **Link app:** https://app-dich-tieng-anh-trung.onrender.com
- **Mã nguồn:** GitHub `viet-trung-translator/app-dich-tieng-anh-trung`
- **Máy chủ:** Render (Docker). **CSDL:** Neon (PostgreSQL).
- **Biến môi trường:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`, `JWT_SECRET`.
- **Chi phí vận hành:** mỗi cuộc gọi chạy 2 phiên Gemini (2 chiều) → tốn API ~2x thời lượng gọi; cộng phí máy chủ nếu nâng gói.
