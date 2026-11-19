---
name: ios-lock-screen-audio
description: Quy tắc và checklist để phát nhạc nền và điều khiển trên màn hình khoá iPhone (Trước/Sau, tua thanh thời gian, tên track, ảnh bìa) bằng Media Session API với file mix chia thành nhiều track. Dùng khi sửa <audio>, play(), seek, navigator.mediaSession, setPositionState, ảnh bìa lock screen, signed URL hết hạn khi đang phát, hoặc khi người dùng báo "khoá màn hình thì mất nút / không tua được / ngừng phát / hiện nút ±10s / tên track không đổi" trên iPhone.
---

# Lock screen audio trên iOS Safari (mô hình mix + track)

Logic chuyển track ở `mix-segment-playback`. Skill này giữ các ràng buộc riêng của iOS.

## Quy tắc
1. **Một `<audio>` duy nhất, có `playsinline`.** `play()` phải chạy trong cử chỉ chạm hoặc trong handler của Media Session; gán `src` và `play()` đồng bộ, việc async (ảnh bìa, signed URL tiếp theo) làm sau.
2. **Chỉ đăng ký `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`.** Nếu có `seekbackward`/`seekforward`, iOS thay nút Trước/Sau bằng ±10 giây. Đặt hai handler đó là `null`.
3. **Thanh tua lock screen tính theo track, không theo cả mix.** `setPositionState({duration: track.end - track.start, position: audio.currentTime - track.start, playbackRate})`, `position` kẹp trong `[0, duration]`. Gọi khi: đổi track, `seeked`, `play`, `pause`, `ratechange`, `loadedmetadata`. Bọc `try/catch`.
4. **`seekto`**: `audio.currentTime = track.start + details.seekTime`, rồi gọi lại `setPositionState`.
5. **Đổi track ở ranh giới phải cập nhật `metadata` và `positionState`**: phát hiện qua `timeupdate` (vẫn chạy khi khoá máy lúc đang phát). `metadata`: `title` = tên track, `artist` = nghệ sĩ, `album` = tên mix, `artwork` = ảnh bìa mix.
6. **Ảnh bìa dùng data URL 512×512 JPEG** tạo bằng canvas (từ ảnh bìa mix; không có thì vẽ chữ cái đầu trắng trên nền đen). Đặt `metadata` ngay với chữ, cập nhật lại khi ảnh sẵn sàng.
7. `playbackState` theo sự kiện `play`/`pause`. Hết mix và không còn gì để phát: `metadata = null`, `playbackState = 'none'`.
8. Không dùng `muted` hay `volume = 0` để "tắt tiếng tạm".
9. Nút Trước: đã phát > 3 giây trong track thì về đầu track, ngược lại mới lùi track.
10. **Signed URL phải sống đủ lâu** (≥ 24 giờ) và có cơ chế làm mới khi `error` (xem `supabase-backend`), nếu không nhạc dừng giữa chừng khi khoá máy.

## Chuẩn bị file audio (quan trọng cho việc tua)
Tua tới 24:45 cần Safari seek chính xác bằng HTTP Range:
- Dùng **AAC trong m4a** hoặc **MP3 CBR**, tránh MP3 VBR không có header Xing (thời lượng và vị trí tua có thể lệch hàng chục giây).
- Với m4a đặt `moov` atom ở đầu file để bắt đầu phát và seek nhanh:
  `ffmpeg -i mix.wav -c:a aac -b:a 96k -movflags +faststart mix.m4a`
- 96 kbps AAC ≈ 43 MB/giờ, vừa giới hạn 50 MB/file của gói Free Supabase. 128 kbps ≈ 58 MB/giờ, cần gói cao hơn.
- Sau khi upload, kiểm tra một track giữa mix: tua tới `start` đã khai báo phải nghe đúng chỗ (±1 giây).

## Giới hạn cần nói thật với người dùng
- iOS không cho web app chỉnh âm lượng bằng JS; dùng nút máy.
- Định dạng: MP3, M4A/AAC, WAV, FLAC phát được; OGG/Opus phần lớn không.
- Tab nền có thể bị hệ điều hành dừng khi thiếu RAM; chế độ Màn hình chính (PWA) ổn định hơn tab Safari.
- Đăng nhập Supabase trong app Màn hình chính tách biệt với Safari, phải đăng nhập lại một lần.

## Checklist test (bắt buộc trên iPhone thật)
- [ ] Phát một mix, khoá máy: nhạc vẫn chạy.
- [ ] Lock screen hiện tên **track**, nghệ sĩ, tên mix, ảnh bìa.
- [ ] Để mix tự chạy qua ranh giới giữa hai track khi đang khoá máy: tên track trên lock screen tự đổi.
- [ ] Nút Sau/Trước trên lock screen nhảy đúng `start` của track kề bên, **liên tiếp nhiều lần**.
- [ ] Kéo thanh thời gian trên lock screen: thanh dài bằng track, nhạc nhảy đúng chỗ, không giật về vị trí cũ.
- [ ] Track đầu tiên (kể cả "Mở đầu") và track cuối: Trước/Sau không phá trạng thái.
- [ ] Mở sang app khác rồi quay lại: UI khớp track đang phát.
- [ ] Phát liên tục lâu hơn thời hạn signed URL (hoặc giả lập hết hạn): nhạc tự khôi phục đúng vị trí.
- [ ] Không có nút ±10 giây thay cho Trước/Sau.
