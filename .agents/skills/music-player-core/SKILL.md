---
name: music-player-core
description: Kiến trúc, ràng buộc và thứ tự làm việc cho project "Nhạc" — web app nghe các file mix/set dài, mỗi file chia thành nhiều track theo file CSV, audio và metadata lưu trên Supabase, Vite + React (JavaScript) + Tailwind v4 + HeroUI v3, deploy Vercel, tối ưu iPhone Safari, giao diện đen trắng tối giản. Dùng skill này đầu tiên cho mọi việc trong project (thêm trang, sửa player, đổi giao diện, cấu hình env, deploy), kể cả khi người dùng chỉ nói "thêm nút…", "làm trang thư viện…", "sửa lỗi player…".
---

# Nhạc — kiến trúc chung

## Khái niệm
- **Mix**: một file audio dài duy nhất (vd set DJ 1 giờ) nằm trong Supabase Storage.
- **Track**: một đoạn của mix, xác định bằng `start_seconds`. Kết thúc = bắt đầu của track kế tiếp, track cuối kết thúc ở cuối file.
- Người dùng thấy và điều khiển theo **track** (tên, nghệ sĩ, Trước/Sau, thanh tua theo track), nhưng bên dưới chỉ phát **một file liên tục**.
- Tracklist nhập bằng CSV → `mix-tracklist-csv`.

## Stack và ràng buộc cứng
- **Vite + React 19 + JavaScript (`.jsx`, không TypeScript) + Tailwind CSS v4 + HeroUI v3** (`@heroui/react`, `@heroui/styles`). Icon: `lucide-react`. Routing: `HashRouter` của `react-router-dom` (không cần `vercel.json`).
- **HeroUI v3, không phải v2.** v3 không có `HeroUIProvider`, không có `tailwind.config.js` cho HeroUI, API component đổi (vd `ListBox`, compound components). **Trước khi dùng bất kỳ component nào, tra skill `heroui-react` hoặc docs v3** (heroui.com/en/docs/react); không viết theo trí nhớ và không dùng cú pháp v2. Skill `music-player-webapp` (nếu có) viết theo v2 và coi mỗi file là một bài → **không dùng** cho project này.
- Backend duy nhất là **Supabase gọi thẳng từ trình duyệt**, không viết server, không Edge Function. Chi tiết, tên biến env, key → `supabase-backend`.
- Biến env: chỉ `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`. Không bao giờ đặt secret key / `service_role` trong biến có tiền tố `VITE_`, trong repo, hay trong code frontend.
- **Một `<audio>` duy nhất**, tạo một lần trong `PlayerProvider` đặt ở gốc app (ngoài mọi route, không bị unmount khi đổi trang). Toàn bộ state phát (mix, track, trạng thái, thời gian) nằm ở provider này; MiniPlayer, Full player, Media Session chỉ đọc từ đó. Logic → `mix-segment-playback`, `ios-lock-screen-audio`.
- Một người dùng duy nhất, đăng nhập email + mật khẩu của tài khoản tạo sẵn. Không có đăng ký.

## Thiết kế (đen trắng, tối giản)
- Ép dark: `<html class="dark">`, `color-scheme: dark`. Chỉ đen `#000`, trắng, các mức xám; không màu nhấn. Ghi đè biến theme của HeroUI theo docs theming v3 (tra tên biến ở docs, không đoán).
- Một font hệ thống (SF trên iPhone). Chữ thường kiểu câu, không in hoa toàn bộ, không nhãn trang trí.
- Một điểm nhấn: nút play tròn trắng và thanh tua. Còn lại im lặng.
- Thư viện nhóm theo mix: tiêu đề mix, bên dưới là các track (tên, nghệ sĩ, `m:ss` bắt đầu). Track đang phát có vạch trắng bên trái. Full player: tên track, nghệ sĩ, tên mix (dòng phụ), ảnh bìa, thanh tua theo track.
- Mobile-first: `MiniPlayer` cố định đáy, chạm mở full player. Mục tiêu chạm ≥ 44px, chừa `env(safe-area-inset-*)`, `100dvh`, tôn trọng `prefers-reduced-motion`. Test 375px, 390px, 768px.
- Chữ giao diện tiếng Việt, động từ rõ ràng ("Thêm mix", "Nhập tracklist", "Xoá"). Lỗi nêu nguyên nhân và cách sửa.

## Cấu trúc đề xuất
```
src/
  main.jsx, App.jsx
  index.css                 # @import "tailwindcss"; @import "@heroui/styles";
  lib/supabase.js           # createClient từ import.meta.env
  lib/tracklist.js          # parse CSV (từ mix-tracklist-csv/references)
  player/PlayerProvider.jsx # <audio> duy nhất, state, Media Session
  pages/ Login, Library, MixDetail, AddMix
  components/ MiniPlayer, FullPlayer, TrackRow, MixCard, CsvPreview
```

## Khởi tạo (đã làm sẵn nếu người dùng nói vậy; chỉ kiểm tra, không làm lại)
```
npm create vite@latest nhac -- --template react
cd nhac && npm i
npm i tailwindcss @tailwindcss/vite @heroui/react @heroui/styles @supabase/supabase-js react-router-dom lucide-react
```
- `vite.config.js`: `plugins: [react(), tailwindcss()]` (import từ `@vitejs/plugin-react` và `@tailwindcss/vite`).
- `src/index.css` chỉ gồm hai dòng, đúng thứ tự (tailwindcss trước): `@import "tailwindcss";` rồi `@import "@heroui/styles";`. Xoá `App.css` mặc định.
- `index.html`: `<html lang="vi" class="dark">`, `viewport` có `viewport-fit=cover`, `theme-color` `#000000`, các thẻ `apple-mobile-web-app-*`.
- `.env.local` (không commit) và `.env.example` (commit, chỉ có tên biến).

## Deploy Vercel
Import repo, preset **Vite** (build `npm run build`, output `dist`). Thêm hai biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` trong Project Settings → Environment Variables cho cả Production và Preview. Biến `VITE_` được nhúng lúc build, nên đổi giá trị phải **redeploy**.

## Thứ tự làm việc (không nhảy cóc)
1. Kiểm tra khởi tạo + kết nối Supabase → `supabase-backend`
2. Đăng nhập
3. Thêm mix: chọn file, đo thời lượng, upload, nhập CSV, xem trước, lưu → `mix-tracklist-csv` + `supabase-backend`
4. Thư viện nhóm theo mix, trang chi tiết mix
5. Phát theo track: Trước/Sau, tua, repeat → `mix-segment-playback`
6. Lock screen, ảnh bìa, PWA → `ios-lock-screen-audio`
7. Deploy Vercel, test trên iPhone thật
