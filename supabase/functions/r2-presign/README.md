# Hướng dẫn cấu hình Cloudflare R2 & Supabase Edge Function

Hệ thống đã được chuyển sang upload file trực tiếp từ trình duyệt lên **Cloudflare R2** thông qua **Presigned PUT URL** do Supabase Edge Function cấp phát, và phát nhạc trực tiếp qua **R2 Public Bucket** (không tốn phí băng thông, không giới hạn 50MB của Supabase Free).

---

## 1. Cấu hình trên Cloudflare Dashboard (R2)

### A. Tạo Bucket
1. Vào Cloudflare Dashboard → **R2** → **Create bucket** (ví dụ đặt tên: `nhac-audio`).

### B. Bật Public Access (Custom Domain hoặc r2.dev)
1. Trong bucket `nhac-audio` → chọn tab **Settings**.
2. Tại mục **Public access**:
   - Chọn **Connect Domain** (khuyên dùng tên miền riêng của bạn, ví dụ `media.yourdomain.com`).
   - HOẶC bật **R2.dev subdomain** (ví dụ: `https://pub-xxxxxxxx.r2.dev`).
3. Lưu lại URL này, bạn sẽ dùng nó cho `R2_PUBLIC_URL`.

### C. Cấu hình CORS Policy (Bắt buộc)
1. Cũng trong tab **Settings** của bucket → cuộn xuống mục **CORS Policy** → bấm **Add CORS Policy**.
2. Dán cấu hình JSON sau:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://*.vercel.app",
      "https://yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Range",
      "Accept-Ranges"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### D. Tạo R2 API Tokens
1. Tại trang chính của R2 → chọn **Manage R2 API Tokens** ở menu bên phải.
2. Bấm **Create API Token**:
   - Quyền (Permissions): **Object Read & Write** (chọn bucket `nhac-audio`).
   - TTL: Tuỳ chọn hoặc để vĩnh viễn.
3. Bấm **Create API Token** và lưu lại:
   - **Account ID**
   - **Access Key ID**
   - **Secret Access Key**

---

## 2. Cấu hình & Deploy Supabase Edge Function

### A. Cài đặt Supabase Secrets
Chạy lệnh CLI sau trong terminal máy bạn (hoặc vào Dashboard Supabase → Edge Functions → Secrets):

```bash
npx supabase secrets set \
  R2_ACCOUNT_ID="your_cloudflare_account_id" \
  R2_ACCESS_KEY_ID="your_r2_access_key_id" \
  R2_SECRET_ACCESS_KEY="your_r2_secret_access_key" \
  R2_BUCKET_NAME="nhac-audio" \
  R2_PUBLIC_URL="https://pub-xxxxxxxx.r2.dev"
```

*(Thay thế bằng các giá trị thực tế của bạn)*

### B. Deploy Edge Function `r2-presign`
Đứng tại thư mục gốc của project:

```bash
npx supabase functions deploy r2-presign --no-verify-jwt
```
*(Hoặc bỏ `--no-verify-jwt` nếu bạn muốn Supabase Gateway tự kiểm tra JWT trước khi vào code)*

---

## 3. Cấu hình Frontend (`.env.local` & Vercel)

Thêm biến `VITE_R2_PUBLIC_URL` vào file `.env.local` và trên **Vercel Project Settings > Environment Variables**:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

---

## 4. Kiểm tra hoạt động
1. Khởi động app: `npm run dev`
2. Đăng nhập → bấm **Thêm mix**.
3. Chọn file audio → nhập tên → bấm **Upload và tiếp tục**.
4. Trình duyệt sẽ:
   - Gọi Edge Function `r2-presign` để lấy Presigned PUT URL.
   - Bắn trực tiếp file lên Cloudflare R2 kèm thanh tiến trình %.
   - Lưu public URL vào bảng `mixes` trên Supabase.
5. Sau khi lưu tracklist, bấm Play → audio phát trực tiếp từ CDN R2 tốc độ cao, hỗ trợ Range Request tua mượt mà trên iPhone.
