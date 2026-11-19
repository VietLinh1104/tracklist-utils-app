---
name: mix-segment-playback
description: Cách phát nhiều track trong một file mix duy nhất bằng một thẻ <audio>: xác định track hiện tại theo thời gian, Trước/Sau bằng seek, tua tính theo track, repeat, chuyển sang mix kế tiếp, đổi track mà không đổi src. Dùng khi viết hoặc sửa logic player, hàng đợi, nút next/prev, thanh tua, repeat/shuffle, danh sách track của mix, hoặc khi người dùng báo "next nhảy sai chỗ", "track không đổi tên khi đang phát", "tua lệch".
---

# Phát track trong một file mix

## Nguyên tắc
- **Nguồn sự thật là `audio.currentTime`.** Track hiện tại luôn được suy ra từ thời gian, không giữ một chỉ số riêng để đồng bộ bằng tay.
- **Đổi track = seek**, không đổi `src`, không tạo `<audio>` mới, không pause ở ranh giới. Mix liền mạch, và lock screen không bị ngắt.
- Chỉ đổi `src` khi sang **mix khác**.
- Mix chưa có tracklist: dùng track ảo `{name: tên mix, start: 0, end: duration}` để mọi logic dưới đây chạy y hệt, không nhánh riêng.

## Dữ liệu trong bộ nhớ
`tracks` của mix đang phát, sắp theo `start`, mỗi phần tử `{name, artist, start, end}` (từ `tracks_timed`, có thêm "Mở đầu" nếu CSV bắt đầu sau 0). `queue` = danh sách mix; `mixIdx`.

## Thuật toán
```
trackAt(t):            // tìm nhị phân track cuối cùng có start <= t + 0.05
cur = trackAt(audio.currentTime)

onTimeUpdate / seeked / loadedmetadata:
  i = trackAt(audio.currentTime)
  if i != cur: cur = i; cập nhật UI, metadata lock screen, positionState
  cập nhật thanh tua: value = currentTime - start, max = end - start

next():
  if cur < last: audio.currentTime = tracks[cur+1].start
  else: sang mix kế (queue) hoặc dừng; hết queue + repeat all thì về mix đầu

prev():
  if currentTime - tracks[cur].start > 3: audio.currentTime = tracks[cur].start
  elif cur > 0: audio.currentTime = tracks[cur-1].start
  else: mix trước (nhảy tới track CUỐI của nó) hoặc về đầu mix hiện tại

seekToTrackTime(x):    // từ thanh tua và từ lock screen (details.seekTime)
  audio.currentTime = clamp(tracks[cur].start + x, start, end - 0.05)

chạm một track trong danh sách:
  cùng mix: audio.currentTime = track.start; audio.play()
  khác mix: audio.src = url; audio.play() (ngay trong cử chỉ chạm);
            once('loadedmetadata') → audio.currentTime = track.start
```
- Không dùng media fragment `#t=` để nhảy, Safari xử lý không nhất quán; luôn gán `currentTime` sau `loadedmetadata`.
- Hết file (`ended`): sang mix kế tiếp trong queue, hoặc dừng. Khi dừng, đưa `currentTime` về 0 và để UI ở trạng thái tạm dừng.

## Repeat và shuffle
- Repeat: `off` | `all` (lặp queue các mix) | `one` (lặp track hiện tại: khi `currentTime >= end - 0.05` thì seek về `start`). Phát hiện bằng `timeupdate` nên có thể trễ ≤ ~0,25 giây; chấp nhận được, ghi chú trong code.
- **Không shuffle track trong một mix**: mix là chuỗi liền mạch, nhảy ngẫu nhiên giữa các track gây cắt đột ngột. Nếu cần shuffle thì chỉ xáo thứ tự các mix trong queue.

## Giao diện liên quan
- Thanh tua trong full player tính theo track (0 → độ dài track), khớp với thanh trên lock screen. Có thể thêm vạch mỏng tiến độ toàn mix.
- Danh sách track của mix hiển thị `m:ss` bắt đầu; track đang phát có vạch trắng; chạm để nhảy.
- Khi người dùng đang kéo thanh tua, tạm dừng cập nhật `value` từ `timeupdate` (cờ `dragging`), commit ở `change`.

## Lưu vị trí nghe (tuỳ chọn)
Lưu `{mixId, currentTime}` vào localStorage mỗi ~5 giây và khi `pause`; khi mở app, nạp mix đó ở trạng thái tạm dừng. Không tự phát khi mở app (iOS chặn autoplay).

## Trong React
- `PlayerProvider` ở gốc app giữ `<audio ref>` (render một lần), `tracks`, `cur`, `isPlaying`, `repeat`, và các hàm `playTrack`, `next`, `prev`, `seekInTrack`. Không đặt `<audio>` trong component thuộc route (sẽ bị unmount khi đổi trang và nhạc ngắt).
- `currentTime` thay đổi ~4 lần/giây: **không** đưa vào state dùng chung cho toàn app. Chỉ component thanh tua/thời gian đăng ký `timeupdate` và giữ state riêng, hoặc đọc qua `ref`. Provider chỉ cập nhật state khi **track đổi** hoặc play/pause đổi.
- Đăng ký listener của `<audio>` và `navigator.mediaSession` trong `useEffect` có hàm dọn dẹp; handler Media Session đọc state qua `ref` để không bị "stale closure" khi track đổi.
