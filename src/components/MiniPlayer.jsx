/**
 * MiniPlayer — Floating Capsule cố định gần đáy màn hình.
 * Thiết kế tĩnh, đen trắng tối giản, không animation thừa.
 */
import { useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, SkipForward } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'

export default function MiniPlayer({ onOpenFull }) {
  const { mix, tracks, curIdx, isPlaying, togglePlay, next, audioRef } = usePlayer()
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(null)

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
      className="fixed left-3 right-3 z-40 mx-auto max-w-lg"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-zinc-850 bg-zinc-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
        {/* Vùng chạm mở FullPlayer */}
        <button
          onClick={onOpenFull}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label="Mở full player"
        >
          {/* Icon nốt nhạc tĩnh */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300">
            <Music size={18} />
          </div>

          {/* Tên bài & Nghệ sĩ */}
          <div className="min-w-0 flex-1 pr-2">
            <p className="truncate text-sm font-semibold text-white">
              {curTrack?.name ?? mix.title}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {curTrack?.artist || mix.title}
            </p>
          </div>
        </button>

        {/* Nút điều khiển nhanh */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={togglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-md active:scale-95"
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? (
              <Pause size={18} fill="black" />
            ) : (
              <Play size={18} fill="black" className="ml-0.5" />
            )}
          </button>

          <button
            onClick={next}
            className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white active:scale-95"
            aria-label="Bài kế tiếp"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Thanh tiến trình mỏng chạy sát đáy */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900">
          <div
            className="h-full bg-white transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
