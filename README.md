# Website video hướng dẫn IT - Ricons

Website tĩnh (HTML + CSS + JS), không cần build. Danh sách video nằm hết trong `videos.json`.

## Cấu trúc thư mục

```
index.html                  Trang chủ (tìm kiếm, mục lục, video mới)
video.html                  Trang xem video (?id=IT-001)
videos.json                 DỮ LIỆU: danh mục + danh sách video  <- file bạn sửa nhiều nhất
css/style.css               Giao diện
js/app.js                   Đọc videos.json và dựng trang
assets/                     Logo Ricons
tools/add-video.ps1         Script thêm video từ link Vimeo
preview.bat                 Xem thử trên máy (http://localhost:8080)
vercel.json                 Cấu hình nếu host trên Vercel
staticwebapp.config.json    Cấu hình nếu host trên Azure Static Web Apps (bắt buộc đăng nhập)
```

## 1. Xem thử trên máy

Bấm đúp `preview.bat` (cần Python), trình duyệt mở `http://localhost:8080`.
Không mở trực tiếp `index.html` bằng cách bấm đúp, vì trình duyệt chặn việc đọc `videos.json`.

4 video trong `videos.json` hiện là **dữ liệu mẫu** (chưa có ID Vimeo). Thêm video thật xong thì xoá 4 video mẫu.

## 2. Chuẩn bị video trên Vimeo

1. Tải video lên Vimeo.
2. Vào *Settings → Privacy*: *Who can watch* chọn **Hide from Vimeo** (hoặc Unlisted), *Where can this be embedded* chọn **Specific domains** rồi thêm tên miền website (ví dụ `video.ricons.vn`).
3. Nếu chọn Unlisted, link có dạng `vimeo.com/123456789/abcdef1234`: phần `abcdef1234` là *hash*, cần giữ khi thêm video.

## 3. Thêm video

### Cách A: dùng script (nhanh)

Mở PowerShell trong thư mục website:

```powershell
.\tools\add-video.ps1 -VimeoUrl "https://vimeo.com/123456789" -CategoryId IT-03
```

Script tự lấy tiêu đề, thời lượng, ảnh bìa và thêm một khối vào `videos.json` (có sao lưu `videos.json.bak`).
Video giới hạn nhúng theo domain thì dùng thêm token: `-Token "<Vimeo access token>"` (tạo tại developer.vimeo.com/apps).
Nếu script không lấy được thông tin, nó sẽ hỏi bạn nhập tay tiêu đề và thời lượng.

### Cách B: sửa tay `videos.json`

Thêm một khối vào mảng `videos`:

```json
{
  "id": "IT-007",
  "vimeoId": "123456789",
  "vimeoHash": "",
  "title": "Cách cài WPS Office",
  "categoryId": "IT-07",
  "duration": "03:20",
  "date": "2026-10-25",
  "description": "Cài đặt và kích hoạt WPS trên máy công ty.",
  "thumbnail": "",
  "keywords": ["wps", "cài phần mềm"],
  "chapters": [{ "t": "00:00", "title": "Tải bộ cài" }],
  "transcript": [{ "t": "00:00", "text": "Nội dung lời thoại..." }],
  "attachments": [{ "name": "Hướng dẫn WPS", "type": "PDF", "url": "https://..." }]
}
```

- Bắt buộc: `id`, `vimeoId`, `title`, `categoryId`, `duration`, `date`.
- `keywords`: từ khoá để ô tìm kiếm tìm ra video (người dùng hay gõ triệu chứng như "không vào được mail").
- `chapters` và `transcript`: bấm vào mốc thời gian thì video nhảy tới đúng đoạn. Có thể để `[]`.
- Video đăng trong vòng 30 ngày (đổi ở `settings.newDays`) tự có nhãn MỚI.
- Thêm danh mục mới: thêm một dòng vào mảng `categories` (mã dạng `IT-09`).

Sau khi sửa, lưu file và đưa lên web (mục 4). Trang chủ, mục lục và trang xem video tự cập nhật.

### Nút "Đề xuất video" và "Chưa, tôi cần hỗ trợ"

Điền link Microsoft Forms vào `settings.feedbackUrl` trong `videos.json`. Để trống thì hai nút này chưa dẫn đi đâu.

## 4. Đưa lên web

### Vercel (cách bạn đang host UnifyApps)

1. Tạo repo GitHub (ví dụ `it-video`), đưa toàn bộ thư mục này vào.
2. Vercel → *Add New → Project* → chọn repo → *Deploy* (Framework: *Other*, để trống Build Command và Output Directory).
3. Được địa chỉ `xxx.vercel.app`. Muốn tên riêng như `video.ricons.vn`: *Settings → Domains → Add*, rồi tạo bản ghi CNAME ở nơi quản lý DNS của Ricons.
4. Từ đó mỗi lần push lên GitHub, Vercel tự đăng lại sau khoảng 1 phút.

Vercel mặc định là công khai: ai có link đều xem được trang. Video vẫn được Vimeo giới hạn theo domain (bước 2 ở mục 2), nhưng danh sách và tiêu đề video thì lộ. Muốn giới hạn người xem, dùng cách bảo vệ bạn đang áp cho UnifyApps, hoặc chọn Azure bên dưới.

### Azure Static Web Apps (đăng nhập bằng M365)

1. Azure Portal → tạo *Static Web App*, nối với repo GitHub, *Build preset: Custom*, để trống đường dẫn build.
2. File `staticwebapp.config.json` đã có sẵn, bắt buộc đăng nhập mới xem được.
3. **Lưu ý quan trọng**: đăng nhập có sẵn của Azure không giới hạn trong tenant Ricons. Muốn chỉ tài khoản Ricons vào được, phải đăng ký ứng dụng Entra ID riêng (custom authentication) và cấu hình `openIdIssuer` theo tenant ID của Ricons. Theo [tài liệu Microsoft](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom), phần này **cần gói Standard (trả phí)**, không dùng được trên gói Free.

### Máy chủ nội bộ (IIS, nginx, Web Station trên NAS)

Chép nguyên thư mục vào thư mục gốc của site. Không cần cài gì thêm. Chỉ người trong mạng công ty (hoặc qua VPN) truy cập được. Nhớ thêm tên miền của site vào danh sách domain được nhúng trên Vimeo.

## Ghi chú

- Mỗi người xem tải trình phát từ Vimeo, nên máy cần ra được Internet (`player.vimeo.com`).
- Phông chữ lấy từ Google Fonts; nếu bị chặn, trình duyệt tự dùng phông hệ thống, giao diện vẫn dùng được.
- Trang chạy được khi không có `vimeoId`: hiển thị khung báo "chưa gắn ID Vimeo".
