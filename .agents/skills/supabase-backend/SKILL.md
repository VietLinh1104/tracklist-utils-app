---
name: supabase-backend
description: Schema Postgres, RLS, grants, Storage bucket, biến env VITE_, đăng nhập một tài khoản, upload file mix và phát bằng signed URL cho project "Nhạc" (Vite + React trên Vercel gọi thẳng Supabase). Dùng khi viết hoặc sửa bất cứ thứ gì liên quan Supabase: tạo bảng mixes/tracks, policy, upload audio, đọc danh sách, lưu tracklist, đăng nhập, lỗi 401/403/CORS, hết hạn URL, giới hạn dung lượng.
---

# Supabase cho Nhạc

SQL đầy đủ nằm ở `references/schema.sql`: chạy trong SQL Editor, không viết lại từ trí nhớ.

## Mô hình
- `mixes`: `id`, `owner_id`, `title`, `audio_path`, `mime_type`, `size_bytes`, `duration_seconds`, `cover_path`.
- `tracks`: `mix_id`, `position`, `name`, `artist`, `start_seconds`. **Chỉ lưu start**; end do view `tracks_timed` tính bằng `lead()`, tránh dữ liệu mâu thuẫn.
- Bucket **private** `audio`, đường dẫn `<owner_id>/<mix_id>.<ext>`, ảnh bìa `<owner_id>/<mix_id>-cover.jpg`.
- `replace_tracks(p_mix_id, p_tracks jsonb)`: xoá và chèn lại toàn bộ track trong một giao dịch.

## Bảo mật (single-user)
Publishable key công khai, nên bảo mật hoàn toàn dựa vào RLS, grants và Auth:
1. Dashboard → Authentication: **tắt đăng ký người dùng mới**, tạo tay đúng một user (email + mật khẩu). Nếu để mở đăng ký, ai cũng thành `authenticated`.
2. Mọi policy kiểm tra `owner_id = auth.uid()` (bảng) và thư mục đầu của đường dẫn = `auth.uid()` (storage), không chỉ `to authenticated`.
3. Grants rõ ràng trong `schema.sql`: thu quyền của `anon`, chỉ cấp cho `authenticated`. Kiểm tra bằng request thật qua client, không dựa vào kết quả xanh trong SQL Editor (nó chạy bằng role đặc quyền).
4. Client: `supabase.auth.signInWithPassword`; session lưu ở localStorage của trình duyệt. **App thêm vào Màn hình chính trên iOS có kho lưu trữ riêng so với Safari**, nên phải đăng nhập lại một lần trong app đó.

## Kết nối và biến env
- Cài `@supabase/supabase-js`. Tạo một client dùng chung ở `src/lib/supabase.js`:
  `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)`.
- `.env.local` (không commit) và `.env.example` (commit, chỉ tên biến):
  ```
  VITE_SUPABASE_URL=https://<project-ref>.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  ```
- **Publishable key** (`sb_publishable_...`) thay cho **anon key** cũ; quyền hạn như nhau, công khai theo thiết kế. Key legacy `anon` vẫn chạy cho tới khi bị tắt (Supabase dự kiến ngừng vào cuối 2026), nên dự án mới dùng publishable. Nếu dashboard chỉ có tab legacy, bấm "Create new API keys".
- Secret key (`sb_secret_...`) và `service_role` **không bao giờ** có mặt trong frontend, repo, hay biến `VITE_`.
- Khi khởi động app, kiểm tra hai biến có giá trị; thiếu thì hiện lỗi rõ "Thiếu cấu hình Supabase" thay vì để app trắng trang.
- Vercel: thêm đúng hai biến này; đổi giá trị phải redeploy (Vite nhúng lúc build).

## Upload mix
1. Chọn file, đo thời lượng bằng `new Audio(URL.createObjectURL(file))` chờ `loadedmetadata`. Cảnh báo nếu là MP3 VBR không có header Xing (thời lượng có thể sai) → khuyên mã hoá lại.
2. `crypto.randomUUID()` cho `mix_id`, upload lên `audio/<owner>/<mix_id>.<ext>` với `contentType` đúng và `cacheControl: '31536000'`.
3. Chỉ sau khi upload xong mới `insert` vào `mixes`; nếu insert lỗi thì xoá object vừa upload (không để file mồ côi).
4. Có thanh tiến trình. File lớn nên dùng resumable upload (TUS) thay vì upload thường, vì mạng di động dễ đứt.

## Giới hạn gói (kiểm tra lại trên trang giá Supabase trước khi chốt, số liệu có thể đổi)
- Gói Free: tối đa **50 MB mỗi file**, 1 GB tổng lưu trữ. Giới hạn toàn cục thắng giới hạn riêng của bucket, nên đặt `file_size_limit` của bucket ≤ 50 MB trên Free.
- Mix 1 giờ cần ≤ 50 MB → AAC ~96 kbps (≈ 43 MB). Mã hoá: xem lệnh ffmpeg ở `ios-lock-screen-audio`. Mix dài hơn hoặc bitrate cao hơn thì cần gói Pro hoặc chia file.
- Mỗi lượt nghe tải về dung lượng file, tính vào băng thông tải xuống hằng tháng. Cảnh báo người dùng nếu nghe lặp nhiều.

## Phát
- `createSignedUrl(path, 86400)` khi bắt đầu phát một mix, giữ trong bộ nhớ cùng thời điểm tạo. Hết hạn giữa chừng sẽ làm range request thất bại, nên: khi `audio` báo `error` hoặc URL đã > 20 giờ, lấy URL mới, gán `src`, chờ `loadedmetadata`, khôi phục `currentTime`, phát tiếp nếu trước đó đang phát.
- Không đưa signed URL vào DB, log hay hash của URL.
- Storage hỗ trợ HTTP Range nên tua được. Đừng tải cả file về bằng `fetch` rồi tạo blob.

## Truy vấn thường dùng
- Thư viện: `from('mixes').select('*, tracks_timed(*)').order('created_at',{ascending:false})`. Nếu PostgREST không nhận view là quan hệ, truy vấn hai lần (`mixes`, rồi `tracks_timed` với `.in('mix_id', ids)`) và ghép ở client.
- Lưu tracklist: `rpc('replace_tracks', { p_mix_id, p_tracks: [{name, artist, start_seconds}] })`.
- Xoá mix: xoá object Storage trước, sau đó xoá dòng `mixes` (track tự xoá theo `on delete cascade`).

## Lỗi thường gặp
- 401/`new row violates row-level security`: chưa đăng nhập, hoặc đường dẫn không bắt đầu bằng `<auth.uid()>/`.
- Upload 413: vượt giới hạn 50 MB của gói Free.
- Danh sách rỗng dù có dữ liệu: view thiếu `security_invoker = true` hoặc user chưa đăng nhập.
