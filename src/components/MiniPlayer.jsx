/**
 * MiniPlayer — thanh cố định đáy màn hình.
 * Hiện khi đang có mix được chọn. Chạm → mở FullPlayer.
 * currentTime đọc qua audioRef (không qua state) để tránh re-render toàn app.
 */
import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../player/PlayerProvider'
import { ChevronUp, Pause, Play, SkipBack, SkipForward } from 'lucide-react'

function formatTime(s) {
  const sec = Math.floor(s ?? 0)
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function MiniPlayer({ onOpenFull }) {
  const { mix, tracks, curIdx, isPlaying, togglePlay, next, prev, audioRef } = usePlayer()
  const [progress, setProgress] = useState(0) // 0–1 cho track hiện tại
  const rafRef = useRef(null)

  // Cập nhật thanh tiến trình qua RAF — không setState toàn app
  useEffect(() => {
    if (!mix) return
    function tick() {
      const audio = audioRef.current
      if (audio && tracks.length) {
        const cur = tracks[curIdx]
        if (cur) {
          const trackDur = cur.end_seconds - cur.start_seconds
          const elapsed = Math.max(0, audio.currentTime - cur.start_seconds)
          setProgress(trackDur > 0 ? Math.min(1, elapsed / trackDur) : 0)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [mix, tracks, curIdx, audioRef])

  if (!mix) return null

  const curTrack = tracks[curIdx]

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-900 bg-black"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Thanh tiến trình mỏng trên đỉnh MiniPlayer */}
      <div className="h-px w-full bg-zinc-800">
        <div
          className="h-full bg-white transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        {/* Thông tin track — chạm để mở full player */}
        <button
          onClick={onOpenFull}
          className="flex min-h-[44px] flex-1 flex-col justify-center overflow-hidden text-left"
          aria-label="Mở full player"
        >
          <span className="truncate text-sm font-medium text-white">
            {curTrack?.name ?? mix.title}
          </span>
          <span className="truncate text-xs text-zinc-500">
            {curTrack?.artist || mix.title}
          </span>
        </button>

        {/* Điều khiển */}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white"
            aria-label="Trước"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black"
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" />}
          </button>

          <button
            onClick={next}
            className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white"
            aria-label="Sau"
          >
            <SkipForward size={20} />
          </button>

          <button
            onClick={onOpenFull}
            className="flex h-11 w-11 items-center justify-center text-zinc-600"
            aria-label="Mở full player"
          >
            <ChevronUp size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
