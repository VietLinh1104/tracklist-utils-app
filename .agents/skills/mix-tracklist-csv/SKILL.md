---
name: mix-tracklist-csv
description: Quy tắc đọc, kiểm tra và nhập file CSV tracklist (name,artist,time) để chia một file mix dài thành nhiều track. Dùng khi người dùng nhắc tới CSV, tracklist, timestamp, "chia bài", "chia track", nhập danh sách bài của một mix, thời điểm dạng [00:03:44](link) hoặc 00:03:44, hoặc khi viết/sửa code parse, xem trước, lưu tracklist.
---

# Nhập tracklist từ CSV

## Định dạng đầu vào
Có header `name,artist,time` (so khớp theo tên cột, không phân biệt hoa thường, thứ tự cột tuỳ ý). Mỗi dòng là một track **bắt đầu** tại `time`. Ví dụ đầy đủ: `references/example.csv`.

```
name,artist,time
Shooting Stars,Bag Raiders,[00:05:25](https://www.youtube.com/?t=325s)
```

Ô `time` chấp nhận:
1. Markdown link `[HH:MM:SS](url)` hoặc `[MM:SS](url)` (dạng xuất từ YouTube). Lấy thời gian từ **chữ trong ngoặc vuông**.
2. Chữ thuần `HH:MM:SS`, `H:MM:SS`, `MM:SS`.
3. Số giây nguyên, hoặc chỉ có link có `?t=325s`/`&t=325`.

Nếu có cả chữ lẫn `t=` mà lệch quá 1 giây → cảnh báo, ưu tiên chữ. **Bỏ URL**: nó chỉ là link YouTube chung, không phải nguồn audio, không lưu vào DB.

## Quy tắc parse
- Dùng parser CSV đúng chuẩn RFC 4180 (ô có dấu ngoặc kép, dấu phẩy trong tên, CRLF, BOM). **Không** `split(',')`.
- Giữ nguyên `name` và `artist` (dấu nháy, ngoặc, `&`, `/`); chỉ `trim`. Artist rỗng được phép (hiển thị "Không rõ nghệ sĩ"). "Unidentified" hay "Various" vẫn là track hợp lệ.
- Sắp xếp theo thời gian. Hai dòng cùng thời điểm hoặc thời điểm không đọc được → **lỗi**, nêu số dòng (tính cả header là dòng 1).
- `time` ≥ thời lượng file → lỗi. Còn dưới 1 giây tới cuối file → cảnh báo.
- Dòng thiếu `name` → lỗi. Dòng trống ở cuối → bỏ qua.
- `end` không nằm trong CSV: end = start của track kế tiếp; track cuối end = thời lượng file. Thời lượng lấy từ lúc upload (`mixes.duration_seconds`).

## Đoạn mở đầu
Nếu thời điểm đầu tiên > 0 (ví dụ 3:44), thêm một track ảo **"Mở đầu"** từ 0 tới đó. Lý do: nếu không, phần đầu file không có track nào, nút Trước/Sau và thanh tua lock screen sẽ xử lý sai. Cho người dùng tắt bằng một ô chọn ở bước xem trước.

## Luồng giao diện
1. Chọn file CSV (hoặc dán văn bản).
2. Parse → **bảng xem trước**: thứ tự, tên, nghệ sĩ, bắt đầu, độ dài. Lỗi chặn nút lưu; cảnh báo cho phép lưu.
3. Lưu bằng một thao tác nguyên tử (`replace_tracks`, xem `supabase-backend`), thay thế toàn bộ track của mix, không nối thêm. Nhập lại CSV = thay thế, hỏi xác nhận nếu mix đã có track.
4. Mix chưa có tracklist vẫn phát được: coi như một track duy nhất tên bằng tên mix, start 0 (không phân nhánh logic riêng, xem `mix-segment-playback`).

## Kiểm tra
Với `references/example.csv`, 12 dòng phải ra các giây bắt đầu: 224, 325, 883, 1387, 1485, 1838, 1867, 2307, 2377, 2468, 2663, 3433. File mix tương ứng phải dài hơn 57:13. Cài đặt tham chiếu (đã chạy với file mẫu): `references/parse-tracklist.js`.
