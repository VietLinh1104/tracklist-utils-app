/**
 * PlayerProvider — một <audio> duy nhất ở gốc app.
 * Tối ưu hoá đặc biệt cho iOS Safari / iPhone Lock Screen:
 *   - Render thẻ <audio> trong DOM với playsInline & webkit-playsinline
 *   - Gọi audio.play() ĐỒNG BỘ trong cử chỉ chạm (User Gesture), không qua await
 *   - Đăng ký rõ ràng previoustrack & nexttrack
 *   - Triệt tiêu hoàn toàn seekbackward & seekforward (ngăn iOS hiện nút ±10s/±15s)
 *   - setPositionState tính theo track
 *   - Metadata đổi theo ranh giới từng track
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getMixArtwork } from '../lib/artworkCanvas'

const PlayerContext = createContext(null)
export const usePlayer = () => useContext(PlayerContext)

const SIGNED_URL_TTL = 86400

/** Lấy URL audio đồng bộ từ Cloudflare R2 hoặc path */
function getAudioUrlSync(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const r2Base = (import.meta.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '')
  if (r2Base) return `${r2Base}/${path}`
  return path
}

/** Fallback cho URL Supabase nếu cần */
async function resolveAudioUrl(path) {
  const direct = getAudioUrlSync(path)
  if (direct.startsWith('http://') || direct.startsWith('https://')) {
    return { url: direct, isPublic: true }
  }
  try {
    const { data, error } = await supabase.storage.from('audio').createSignedUrl(path, SIGNED_URL_TTL)
    if (!error && data?.signedUrl) {
      return { url: data.signedUrl, isPublic: false }
    }
  } catch {}
  return { url: path, isPublic: true }
}

/** Tìm nhị phân track cuối có start <= t + 0.05 */
function trackAt(tracks, t) {
  if (!tracks || tracks.length === 0) return 0
  let lo = 0, hi = tracks.length - 1, res = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (tracks[mid].start_seconds <= t + 0.05) {
      res = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return res
}

function normalizeTracks(tracks, durationSeconds) {
  if (!tracks || tracks.length === 0) return []
  return tracks.map((t, i) => ({
    ...t,
    start_seconds: Number(t.start_seconds),
    end_seconds:
      i < tracks.length - 1
        ? Number(tracks[i + 1].start_seconds)
        : Number(t.end_seconds ?? durationSeconds),
  }))
}

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const stateRef = useRef(null)
  const actionsRef = useRef({})

  const [mix, setMix] = useState(null)
  const [tracks, setTracks] = useState([])
  const [curIdx, setCurIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [repeat, setRepeat] = useState('off') // 'off' | 'all' | 'one'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  stateRef.current = { mix, tracks, curIdx, isPlaying, repeat }

  // ─── Đồng bộ positionState của Media Session theo track ──────────
  const updatePositionState = useCallback(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return
    const { tracks, curIdx } = stateRef.current || {}
    const cur = tracks?.[curIdx]
    const audio = audioRef.current
    if (!cur || !audio || !audio.duration) return

    const duration = Math.max(0.1, cur.end_seconds - cur.start_seconds)
    const elapsed = Math.max(0, Math.min(duration, audio.currentTime - cur.start_seconds))

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audio.playbackRate || 1,
        position: elapsed,
      })
    } catch {}
  }, [])

  // ─── Cập nhật metadata cho iOS Lock Screen ───────────────────────
  const updateMediaMetadata = useCallback(async (targetMix, targetTrack) => {
    if (!('mediaSession' in navigator) || !targetMix) return
    const trackName = targetTrack?.name || targetMix.title
    const artistName = targetTrack?.artist || targetMix.title
    const albumName = targetMix.title

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackName,
        artist: artistName,
        album: albumName,
        artwork: [],
      })
    } catch {}

    try {
      const artworkUrl = await getMixArtwork(targetMix, targetTrack)
      if (artworkUrl && navigator.mediaSession.metadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: trackName,
          artist: artistName,
          album: albumName,
          artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }],
        })
      }
    } catch {}
  }, [])

  // ─── Đăng ký các action handlers chuẩn cho iOS ───────────────────
  const registerMediaSessionHandlers = useCallback(() => {
    if (!('mediaSession' in navigator)) return

    // Bắt buộc đăng ký previoustrack và nexttrack
    navigator.mediaSession.setActionHandler('play', () => {
      actionsRef.current.play?.()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      actionsRef.current.pause?.()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      actionsRef.current.prev?.()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      actionsRef.current.next?.()
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        actionsRef.current.seekInTrack?.(details.seekTime)
        actionsRef.current.updatePositionState?.()
      }
    })

    // QUAN TRỌNG: Triệt tiêu seekbackward và seekforward để iOS không hiện nút ±10s/±15s
    try {
      navigator.mediaSession.setActionHandler('seekbackward', null)
    } catch {}
    try {
      navigator.mediaSession.setActionHandler('seekforward', null)
    } catch {}
  }, [])

  // ─── Event listeners cho Audio ──────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function onPlay() {
      setIsPlaying(true)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing'
      }
      registerMediaSessionHandlers()
      updatePositionState()
    }

    function onPause() {
      setIsPlaying(false)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused'
      }
      updatePositionState()
    }

    function onSeeked() {
      updatePositionState()
    }

    function onRateChange() {
      updatePositionState()
    }

    function onLoadedMetadata() {
      updatePositionState()
    }

    function onTimeUpdate() {
      const { tracks, curIdx, repeat, mix } = stateRef.current || {}
      if (!tracks?.length) return
      const i = trackAt(tracks, audio.currentTime)

      // Repeat one
      if (repeat === 'one') {
        const cur = tracks[i]
        if (audio.currentTime >= cur.end_seconds - 0.05) {
          audio.currentTime = cur.start_seconds
          updatePositionState()
          return
        }
      }

      if (i !== curIdx) {
        setCurIdx(i)
        updateMediaMetadata(mix, tracks[i])
        updatePositionState()
      }
    }

    function onEnded() {
      const { repeat } = stateRef.current || {}
      if (repeat === 'all' || repeat === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else {
        audio.currentTime = 0
        setIsPlaying(false)
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none'
          navigator.mediaSession.metadata = null
        }
      }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('ratechange', onRateChange)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    registerMediaSessionHandlers()

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('ratechange', onRateChange)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [registerMediaSessionHandlers, updateMediaMetadata, updatePositionState])

  // ─── togglePlay ─────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!stateRef.current.mix || !audio) return
    if (audio.paused) {
      registerMediaSessionHandlers()
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [registerMediaSessionHandlers])

  // ─── next ───────────────────────────────────────────────────────
  const next = useCallback(() => {
    const { tracks, curIdx, repeat, mix } = stateRef.current || {}
    const audio = audioRef.current
    if (!tracks?.length || !audio) return

    if (curIdx < tracks.length - 1) {
      const nextIdx = curIdx + 1
      audio.currentTime = tracks[nextIdx].start_seconds
      setCurIdx(nextIdx)
      updateMediaMetadata(mix, tracks[nextIdx])
      updatePositionState()
      if (audio.paused) audio.play().catch(() => {})
    } else {
      if (repeat === 'all' || repeat === 'one') {
        audio.currentTime = 0
        setCurIdx(0)
        updateMediaMetadata(mix, tracks[0])
        updatePositionState()
        audio.play().catch(() => {})
      } else {
        audio.pause()
      }
    }
  }, [updateMediaMetadata, updatePositionState])

  // ─── prev ───────────────────────────────────────────────────────
  const prev = useCallback(() => {
    const { tracks, curIdx, mix } = stateRef.current || {}
    const audio = audioRef.current
    if (!tracks?.length || !audio) return
    const curTrack = tracks[curIdx]

    // Nếu đã phát > 3s → về đầu track hiện tại
    if (audio.currentTime - curTrack.start_seconds > 3) {
      audio.currentTime = curTrack.start_seconds
      updatePositionState()
    } else if (curIdx > 0) {
      const prevIdx = curIdx - 1
      audio.currentTime = tracks[prevIdx].start_seconds
      setCurIdx(prevIdx)
      updateMediaMetadata(mix, tracks[prevIdx])
      updatePositionState()
    } else {
      audio.currentTime = 0
      updatePositionState()
    }
    if (audio.paused) audio.play().catch(() => {})
  }, [updateMediaMetadata, updatePositionState])

  // ─── seekInTrack: từ thanh tua và Media Session seekto ─────────
  const seekInTrack = useCallback(
    (trackSec) => {
      const { tracks, curIdx } = stateRef.current || {}
      const audio = audioRef.current
      if (!tracks?.length || !audio) return
      const cur = tracks[curIdx]
      audio.currentTime = Math.max(
        cur.start_seconds,
        Math.min(cur.end_seconds - 0.05, cur.start_seconds + trackSec)
      )
      updatePositionState()
    },
    [updatePositionState]
  )

  // ─── playTrack: chạm track trong danh sách ─────────────────────
  const playTrack = useCallback(
    (trackIdx) => {
      const { tracks, mix } = stateRef.current || {}
      const audio = audioRef.current
      if (!tracks?.length || trackIdx >= tracks.length || !audio) return
      audio.currentTime = tracks[trackIdx].start_seconds
      setCurIdx(trackIdx)
      registerMediaSessionHandlers()
      updateMediaMetadata(mix, tracks[trackIdx])
      updatePositionState()
      if (audio.paused) audio.play().catch(() => {})
    },
    [registerMediaSessionHandlers, updateMediaMetadata, updatePositionState]
  )

  // ─── playMix: PHÁT ĐỒNG BỘ TRONG CỬ CHỈ CHẠM (iOS User Gesture) ──
  const playMix = useCallback(
    (newMix, newTracks, startTrackIdx = 0) => {
      const audio = audioRef.current
      if (!audio) return

      setError('')
      setIsLoading(false)

      const isSameMix = stateRef.current.mix?.id === newMix.id
      const normalized = normalizeTracks(newTracks, newMix.duration_seconds)
      const targetTrack = normalized[startTrackIdx]
      const targetTime = targetTrack?.start_seconds ?? 0

      setMix(newMix)
      setTracks(normalized)
      setCurIdx(startTrackIdx)

      // Cập nhật ngay metadata & action handlers để iOS liên kết đúng remote controls
      registerMediaSessionHandlers()
      updateMediaMetadata(newMix, targetTrack)

      if (!isSameMix) {
        // Lấy URL đồng bộ ngay lập tức để không bị mất gesture context của iOS Safari
        const directUrl = getAudioUrlSync(newMix.audio_path)
        if (directUrl && (directUrl.startsWith('http://') || directUrl.startsWith('https://'))) {
          audio.src = directUrl
          audio.currentTime = targetTime
          // Gọi play() ĐỒNG BỘ trong cùng lượt touch event
          audio.play().catch(() => {})
        } else {
          // Fallback async nếu là file cũ Supabase
          setIsLoading(true)
          resolveAudioUrl(newMix.audio_path).then(({ url }) => {
            audio.src = url
            audio.currentTime = targetTime
            audio.play().catch(() => {})
            setIsLoading(false)
          })
        }
      } else {
        audio.currentTime = targetTime
        audio.play().catch(() => {})
      }

      updatePositionState()
    },
    [registerMediaSessionHandlers, updateMediaMetadata, updatePositionState]
  )

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }, [])

  actionsRef.current = {
    play: () => audioRef.current?.play().catch(() => {}),
    pause: () => audioRef.current?.pause(),
    prev,
    next,
    seekInTrack,
    updatePositionState,
  }

  const value = {
    audioRef,
    mix,
    tracks,
    curIdx,
    isPlaying,
    repeat,
    isLoading,
    error,
    playMix,
    togglePlay,
    next,
    prev,
    seekInTrack,
    playTrack,
    cycleRepeat,
  }

  return (
    <PlayerContext.Provider value={value}>
      {/* Render thẻ audio trực tiếp trong DOM với các thuộc tính iOS Safari */}
      <audio
        ref={audioRef}
        playsInline
        webkit-playsinline="true"
        preload="auto"
        className="hidden"
      />
      {children}
    </PlayerContext.Provider>
  )
}
