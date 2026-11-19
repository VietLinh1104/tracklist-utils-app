/**
 * FullPlayer — Bottom Sheet phủ toàn màn hình chuẩn mobile-first.
 * Thẩm mỹ đen trắng tối giản, đĩa than xoay theo trạng thái phát,
 * thanh tua HeroUI Slider v3, các nút điều khiển lớn >= 48px,
 * sóng âm equalizer animation cho bài đang phát trong tracklist.
 */
import { useEffect, useRef, useState } from 'react'
import { Modal, Slider } from '@heroui/react'
import {
  ChevronDown,
  Disc3,
  ListMusic,
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
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          }}
          aria-label="Full player"
        >
          {/* Grab handle indicator & Header */}
          <div className="flex flex-col border-b border-zinc-900/60 px-4 pt-2 pb-3">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-800" />
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white active:scale-95"
                aria-label="Thu nhỏ"
              >
                <ChevronDown size={24} />
              </button>

              <div className="min-w-0 flex-1 px-2 text-center">
                <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                  ĐANG PHÁT TỪ SET
                </p>
                <p className="truncate text-sm font-medium text-zinc-200">{mix.title}</p>
              </div>

              <div className="w-11" />
            </div>
          </div>

          {/* Body có thể cuộn linh hoạt */}
          <div className="flex flex-1 flex-col justify-between overflow-y-auto px-6 py-6">
            {/* Ảnh bìa đĩa than lớn xoay theo nhạc */}
            <div className="flex flex-1 items-center justify-center py-2">
              <div className="relative flex aspect-square w-full max-w-[280px] items-center justify-center rounded-3xl border border-zinc-850 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-2xl">
                {/* Vòng rãnh đĩa than Vinyl */}
                <div
                  className={[
                    'relative flex aspect-square w-full items-center justify-center rounded-full border-4 border-zinc-800/80 bg-zinc-950 shadow-inner',
                    isPlaying ? 'animate-[spin_16s_linear_infinite]' : '',
                  ].join(' ')}
                >
                  {/* Các rãnh concentric vinyl */}
                  <div className="absolute inset-4 rounded-full border border-zinc-900" />
                  <div className="absolute inset-10 rounded-full border border-zinc-900/60" />
                  <div className="absolute inset-16 rounded-full border border-zinc-850/80" />

                  {/* Tâm đĩa than */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 bg-zinc-900">
                    <Disc3 size={28} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Thông tin track hiện tại */}
            <div className="mt-4 w-full text-center">
              <h2 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
                {curTrack?.name ?? mix.title}
              </h2>
              <p className="mt-1 truncate text-sm font-medium text-zinc-400">
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
                  <Slider.Thumb className="h-4 w-4 border-2 border-black bg-white shadow-md" />
                </Slider.Track>
              </Slider>
              <div className="mt-1.5 flex justify-between font-mono text-xs text-zinc-500 tabular-nums">
                <span>{formatTime(trackPos)}</span>
                <span>-{formatTime(trackDur - trackPos)}</span>
              </div>
            </div>

            {/* Cụm điều khiển phát chính */}
            <div className="mt-6 flex w-full items-center justify-between px-2">
              {/* Nút Repeat */}
              <button
                onClick={cycleRepeat}
                className={[
                  'relative flex h-12 w-12 items-center justify-center rounded-full transition-colors active:scale-90',
                  repeatActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-400',
                ].join(' ')}
                aria-label={`Lặp: ${repeat}`}
                title={`Chế độ lặp: ${repeat}`}
              >
                {repeatIcon}
                {repeatActive && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-white" />
                )}
              </button>

              {/* Nút Trước (⏮) */}
              <button
                onClick={prev}
                className="flex h-14 w-14 items-center justify-center text-white transition-transform active:scale-90"
                aria-label="Bài trước"
              >
                <SkipBack size={32} />
              </button>

              {/* Nút Play/Pause tròn to nổi bật */}
              <button
                onClick={togglePlay}
                className="flex h-18 w-18 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform active:scale-95"
                aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? (
                  <Pause size={30} fill="black" />
                ) : (
                  <Play size={30} fill="black" className="ml-1" />
                )}
              </button>

              {/* Nút Sau (⏭) */}
              <button
                onClick={next}
                className="flex h-14 w-14 items-center justify-center text-white transition-transform active:scale-90"
                aria-label="Bài sau"
              >
                <SkipForward size={32} />
              </button>

              {/* Icon giữ layout đối xứng */}
              <div className="flex h-12 w-12 items-center justify-center text-zinc-600">
                <ListMusic size={20} />
              </div>
            </div>

            {/* Danh sách các track bên trong FullPlayer */}
            <div className="mt-8 w-full border-t border-zinc-900 pt-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                DANH SÁCH BÀI ({tracks.length})
              </p>
              <div className="max-h-48 overflow-y-auto overscroll-contain pr-1">
                <TrackList tracks={tracks} curIdx={curIdx} isPlaying={isPlaying} />
              </div>
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function TrackList({ tracks, curIdx, isPlaying }) {
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
                'flex w-full min-h-[46px] items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                isCurrent
                  ? 'bg-zinc-900/80 text-white'
                  : 'text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200',
              ].join(' ')}
            >
              {/* Chỉ báo sóng âm equalizer cho bài đang phát */}
              <div className="flex w-6 shrink-0 items-center justify-center text-xs font-mono tabular-nums text-zinc-600">
                {isCurrent && isPlaying ? (
                  <div className="flex items-end gap-[2px] h-3">
                    <span className="w-1 bg-white animate-[pulse_0.6s_ease-in-out_infinite] h-3 rounded-full" />
                    <span className="w-1 bg-white animate-[pulse_0.4s_ease-in-out_infinite] h-2 rounded-full" />
                    <span className="w-1 bg-white animate-[pulse_0.8s_ease-in-out_infinite] h-2.5 rounded-full" />
                  </div>
                ) : (
                  <span>{String(i + 1).padStart(2, '0')}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={['truncate text-sm', isCurrent ? 'font-semibold text-white' : ''].join(' ')}>
                  {t.name}
                </p>
                {t.artist && (
                  <p className="truncate text-xs text-zinc-500">{t.artist}</p>
                )}
              </div>

              <span className="shrink-0 text-xs font-mono tabular-nums text-zinc-600">
                {formatTime(t.start_seconds)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
