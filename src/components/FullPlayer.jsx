/**
 * FullPlayer — Modal phủ toàn màn hình.
 * Thanh tua tính theo track (0 → độ dài track).
 * currentTime đọc qua audioRef trực tiếp để tránh re-render toàn app.
 */
import { useEffect, useRef, useState } from 'react'
import { Button, Label, Modal, Slider } from '@heroui/react'
import { ChevronDown, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'

function formatTime(s) {
  const sec = Math.floor(Math.max(0, s ?? 0))
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function FullPlayer({ isOpen, onClose }) {
  const { mix, tracks, curIdx, isPlaying, repeat, togglePlay, next, prev, seekInTrack, cycleRepeat, audioRef } = usePlayer()

  // State riêng cho thanh tua — không dùng state chung
  const [trackPos, setTrackPos] = useState(0)   // giây trong track
  const [trackDur, setTrackDur] = useState(1)   // độ dài track
  const [dragging, setDragging] = useState(false)
  const rafRef = useRef(null)

  // Cập nhật thanh tua qua RAF khi không drag
  useEffect(() => {
    if (!isOpen) return
    function tick() {
      if (!dragging) {
        const audio = audioRef.current
        const cur = tracks[curIdx]
        if (audio && cur) {
          const dur = cur.end_seconds - cur.start_seconds
          const elapsed = Math.max(0, audio.currentTime - cur.start_seconds)
          setTrackDur(dur > 0 ? dur : 1)
          setTrackPos(Math.min(elapsed, dur))
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isOpen, dragging, tracks, curIdx, audioRef])

  // Reset khi track đổi
  useEffect(() => {
    if (!dragging) setTrackPos(0)
  }, [curIdx])

  if (!mix) return null
  const curTrack = tracks[curIdx]

  function handleSliderChange(val) {
    setTrackPos(val)
  }
  function handleSliderChangeEnd(val) {
    setDragging(false)
    seekInTrack(val)
  }

  const repeatIcon = repeat === 'one'
    ? <Repeat1 size={18} />
    : <Repeat size={18} />
  const repeatActive = repeat !== 'off'

  return (
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        variant="opaque"
      >
        <Modal.Container placement="bottom" size="full">
          <Modal.Dialog
            className="flex flex-col bg-black text-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Full player"
          >
            {/* Header */}
            <Modal.Header className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white"
                aria-label="Thu nhỏ"
              >
                <ChevronDown size={22} />
              </button>
              <div className="flex-1 text-center">
                <p className="text-xs text-zinc-500">{mix.title}</p>
              </div>
              <div className="w-11" />
            </Modal.Header>

            <Modal.Body className="flex flex-1 flex-col items-center justify-between gap-6 px-6 py-8">
              {/* Ảnh bìa placeholder */}
              <div className="aspect-square w-full max-w-xs rounded-2xl bg-zinc-900" />

              {/* Thông tin track */}
              <div className="w-full text-center">
                <p className="text-xl font-semibold leading-tight text-white">
                  {curTrack?.name ?? mix.title}
                </p>
                {curTrack?.artist && (
                  <p className="mt-1 text-sm text-zinc-400">{curTrack.artist}</p>
                )}
              </div>

              {/* Thanh tua theo track */}
              <div className="w-full">
                <Slider
                  value={trackPos}
                  minValue={0}
                  maxValue={trackDur}
                  step={0.5}
                  onChange={val => { setDragging(true); handleSliderChange(val) }}
                  onChangeEnd={handleSliderChangeEnd}
                  aria-label="Vị trí trong track"
                  className="w-full"
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <div className="mt-1 flex justify-between text-xs text-zinc-500">
                  <span>{formatTime(trackPos)}</span>
                  <span>-{formatTime(trackDur - trackPos)}</span>
                </div>
              </div>

              {/* Điều khiển phát */}
              <div className="flex w-full items-center justify-between">
                {/* Repeat */}
                <button
                  onClick={cycleRepeat}
                  className={[
                    'flex h-11 w-11 items-center justify-center transition-colors',
                    repeatActive ? 'text-white' : 'text-zinc-600',
                  ].join(' ')}
                  aria-label={`Lặp: ${repeat}`}
                >
                  {repeatIcon}
                </button>

                {/* Trước */}
                <button
                  onClick={prev}
                  className="flex h-14 w-14 items-center justify-center text-white"
                  aria-label="Trước"
                >
                  <SkipBack size={28} />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black"
                  aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                >
                  {isPlaying
                    ? <Pause size={28} fill="black" />
                    : <Play size={28} fill="black" />
                  }
                </button>

                {/* Sau */}
                <button
                  onClick={next}
                  className="flex h-14 w-14 items-center justify-center text-white"
                  aria-label="Sau"
                >
                  <SkipForward size={28} />
                </button>

                {/* Placeholder (cân bằng layout) */}
                <div className="w-11" />
              </div>

              {/* Danh sách track */}
              <TrackList tracks={tracks} curIdx={curIdx} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
    </Modal.Backdrop >
  )
}

// ─── Danh sách track trong FullPlayer ────────────────────────────────
function TrackList({ tracks, curIdx }) {
  const { playTrack } = usePlayer()
  if (!tracks.length) return null

  return (
    <div className="w-full">
      <p className="mb-2 text-xs text-zinc-600">Tracklist</p>
      <ul className="max-h-52 overflow-y-auto overscroll-contain">
        {tracks.map((t, i) => (
          <li key={i}>
            <button
              onClick={() => playTrack(i)}
              className={[
                'flex w-full items-center gap-3 border-l-2 py-2 pl-3 text-left transition-colors',
                i === curIdx
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
              ].join(' ')}
            >
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                {formatTime(t.start_seconds)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.name}</p>
                {t.artist && <p className="truncate text-xs text-zinc-600">{t.artist}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
