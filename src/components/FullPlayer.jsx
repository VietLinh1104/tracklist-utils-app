/**
 * FullPlayer — Bottom Sheet phủ toàn màn hình.
 * Phong cách tĩnh và đơn giản: icon nốt nhạc tĩnh, bài đang phát đậm hơn,
 * thanh tua tinh tế, các nút bấm dễ chạm.
 */
import { useEffect, useRef, useState } from 'react'
import { Modal, Slider } from '@heroui/react'
import {
  ChevronDown,
  ListMusic,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'

function formatTime(s) {
  const sec = Math.floor(Math.max(0, s ?? 0))
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function FullPlayer({ isOpen, onClose }) {
  const {
    mix,
    tracks,
    curIdx,
    isPlaying,
    repeat,
    togglePlay,
    next,
    prev,
    seekInTrack,
    cycleRepeat,
    audioRef,
  } = usePlayer()

  const [trackPos, setTrackPos] = useState(0)
  const [trackDur, setTrackDur] = useState(1)
  const [dragging, setDragging] = useState(false)
  const rafRef = useRef(null)

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

  const repeatIcon =
    repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />
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
          className="flex h-full flex-col bg-black text-white"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
          aria-label="Full player"
        >
          {/* Header */}
          <div className="flex flex-col border-b border-zinc-900 px-4 pt-2 pb-3">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-800" />
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 hover:text-white"
                aria-label="Thu nhỏ"
              >
                <ChevronDown size={22} />
              </button>

              <div className="min-w-0 flex-1 px-2 text-center">
                <p className="truncate text-xs font-medium text-zinc-400">{mix.title}</p>
              </div>

              <div className="w-11" />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col justify-between overflow-y-auto px-6 py-6">
            {/* Ảnh bìa tĩnh: khung tối giản với nốt nhạc */}
            <div className="flex flex-1 items-center justify-center py-4">
              <div className="flex aspect-square w-full max-w-[240px] items-center justify-center rounded-2xl border border-zinc-850 bg-zinc-950 shadow-lg">
                <Music size={48} className="text-zinc-600" />
              </div>
            </div>

            {/* Thông tin track hiện tại */}
            <div className="mt-2 w-full text-center">
              <h2 className="truncate text-xl font-bold tracking-tight text-white">
                {curTrack?.name ?? mix.title}
              </h2>
              <p className="mt-1 truncate text-sm text-zinc-400">
                {curTrack?.artist || mix.title}
              </p>
            </div>

            {/* Thanh tua theo track */}
            <div className="mt-6 w-full">
              <Slider
                value={trackPos}
                minValue={0}
                maxValue={trackDur}
                step={0.5}
                onChange={(val) => {
                  setDragging(true)
                  handleSliderChange(val)
                }}
                onChangeEnd={handleSliderChangeEnd}
                aria-label="Vị trí trong track"
                className="w-full"
              >
                <Slider.Track className="h-1.5 bg-zinc-850">
                  <Slider.Fill className="bg-white" />
                  <Slider.Thumb className="h-4 w-4 border-2 border-black bg-white shadow-sm" />
                </Slider.Track>
              </Slider>
              <div className="mt-1.5 flex justify-between font-mono text-xs text-zinc-500 tabular-nums">
                <span>{formatTime(trackPos)}</span>
                <span>-{formatTime(trackDur - trackPos)}</span>
              </div>
            </div>

            {/* Cụm điều khiển phát chính */}
            <div className="mt-6 flex w-full items-center justify-between px-2">
              <button
                onClick={cycleRepeat}
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                  repeatActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-400',
                ].join(' ')}
                aria-label={`Lặp: ${repeat}`}
                title={`Chế độ lặp: ${repeat}`}
              >
                {repeatIcon}
              </button>

              <button
                onClick={prev}
                className="flex h-14 w-14 items-center justify-center text-white active:scale-95"
                aria-label="Bài trước"
              >
                <SkipBack size={30} />
              </button>

              <button
                onClick={togglePlay}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg active:scale-95"
                aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? (
                  <Pause size={28} fill="black" />
                ) : (
                  <Play size={28} fill="black" className="ml-1" />
                )}
              </button>

              <button
                onClick={next}
                className="flex h-14 w-14 items-center justify-center text-white active:scale-95"
                aria-label="Bài sau"
              >
                <SkipForward size={30} />
              </button>

              <div className="flex h-12 w-12 items-center justify-center text-zinc-600">
                <ListMusic size={20} />
              </div>
            </div>

            {/* Danh sách track bên dưới (chỉ in đậm bài đang chạy) */}
            <div className="mt-8 w-full border-t border-zinc-900 pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">
                DANH SÁCH BÀI ({tracks.length})
              </p>
              <div className="max-h-48 overflow-y-auto overscroll-contain pr-1">
                <TrackList tracks={tracks} curIdx={curIdx} />
              </div>
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function TrackList({ tracks, curIdx }) {
  const { playTrack } = usePlayer()
  if (!tracks.length) return null

  return (
    <ul className="flex flex-col divide-y divide-zinc-900/60">
      {tracks.map((t, i) => {
        const isCurrent = i === curIdx
        return (
          <li key={i}>
            <button
              onClick={() => playTrack(i)}
              className={[
                'flex w-full min-h-[44px] items-center gap-3 px-2 py-2 text-left transition-colors',
                isCurrent ? 'text-white' : 'text-zinc-500 hover:text-zinc-300',
              ].join(' ')}
            >
              <span
                className={[
                  'w-6 shrink-0 text-xs font-mono tabular-nums',
                  isCurrent ? 'font-bold text-white' : 'text-zinc-600',
                ].join(' ')}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={[
                    'truncate text-sm',
                    isCurrent ? 'font-bold text-white' : 'font-normal',
                  ].join(' ')}
                >
                  {t.name}
                </p>
                {t.artist && (
                  <p
                    className={[
                      'truncate text-xs',
                      isCurrent ? 'text-zinc-300' : 'text-zinc-600',
                    ].join(' ')}
                  >
                    {t.artist}
                  </p>
                )}
              </div>

              <span
                className={[
                  'shrink-0 text-xs font-mono tabular-nums',
                  isCurrent ? 'text-zinc-300' : 'text-zinc-600',
                ].join(' ')}
              >
                {formatTime(t.start_seconds)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
