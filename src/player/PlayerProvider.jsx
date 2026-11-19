/**
 * PlayerProvider — một <audio> duy nhất ở gốc app.
 * Hỗ trợ iOS Safari Media Session:
 *   - previoustrack, nexttrack, seekto
 *   - setPositionState tính theo track
 *   - metadata tự đổi ở ranh giới track
 *   - seekbackward/seekforward = null (ngăn iOS hiện nút ±10s)
 *   - artwork 512x512 JPEG data URL
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getMixArtwork } from '../lib/artworkCanvas'

// ─── Context ─────────────────────────────────────────────────────────
const PlayerContext = createContext(null)
export const usePlayer = () => useContext(PlayerContext)

// ─── Hằng số ────────────────────────────────────────────────────────
const SIGNED_URL_TTL = 86400          // 24 giờ
const SIGNED_URL_REFRESH = 20 * 3600 // làm mới khi còn < 4 giờ

/** Tìm nhị phân track cuối có start <= t + 0.05 */
function trackAt(tracks, t) {
  if (!tracks || tracks.length === 0) return 0
  let lo = 0, hi = tracks.length - 1, res = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (tracks[mid].start_seconds <= t + 0.05) { res = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return res
}

/** Lấy URL phát: hỗ trợ Cloudflare R2 Public URL hoặc Supabase signed URL fallback */
async function resolveAudioUrl(path) {
  if (!path) return { url: '', createdAt: Date.now(), isPublic: true }

  // 1. Nếu path đã là full URL (ví dụ R2 public domain https://pub-xxx.r2.dev/...)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return { url: path, createdAt: Date.now(), isPublic: true }
  }

  // 2. Nếu có biến môi trường VITE_R2_PUBLIC_URL
  const r2PublicBase = (import.meta.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '')
  if (r2PublicBase) {
    return { url: `${r2PublicBase}/${path}`, createdAt: Date.now(), isPublic: true }
  }

  // 3. Fallback cho file cũ trên Supabase Storage
  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(path, SIGNED_URL_TTL)
    if (!error && data?.signedUrl) {
      return { url: data.signedUrl, createdAt: Date.now(), isPublic: false }
    }
  } catch {}

  return { url: path, createdAt: Date.now(), isPublic: true }
}

// ─── Provider ────────────────────────────────────────────────────────
export function PlayerProvider({ children }) {
  const audioRef = useRef(null)         // <audio> thật
  const signedUrlRef = useRef(null)     // { url, createdAt }
  const stateRef = useRef(null)         // mirror state để dùng trong closure/event handler
  const actionsRef = useRef({})         // action functions cho Media Session handlers

  // State tần suất thưa
  const [mix, setMix] = useState(null)        // mix đang phát
  const [tracks, setTracks] = useState([])    // tracks của mix đang phát
  const [curIdx, setCurIdx] = useState(0)     // index track hiện tại
  const [isPlaying, setIsPlaying] = useState(false)
  const [repeat, setRepeat] = useState('off') // 'off' | 'all' | 'one'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Giữ state mới nhất trong ref để closure không stale
  stateRef.current = { mix, tracks, curIdx, isPlaying, repeat }

  // ─── Đồng bộ positionState của Media Session ───────────────────
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

  // ─── Cập nhật Media Session metadata ────────────────────────────
  const updateMediaMetadata = useCallback(async (targetMix, targetTrack) => {
    if (!('mediaSession' in navigator) || !targetMix) return
    const trackName = targetTrack?.name || targetMix.title
    const artistName = targetTrack?.artist || targetMix.title
    const albumName = targetMix.title

    // 1. Gán ngay metadata cơ bản (không chờ ảnh để tránh trễ hiển thị)
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackName,
        artist: artistName,
        album: albumName,
        artwork: [],
      })
    } catch {}

    // 2. Lấy ảnh bìa 512x512 JPEG data URL rồi cập nhật lại
    try {
      const artworkUrl = await getMixArtwork(targetMix, targetTrack)
      if (artworkUrl && navigator.mediaSession.metadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: trackName,
          artist: artistName,
          album: albumName,
          artwork: [
            { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
          ],
        })
      }
    } catch {}
  }, [])

  // ─── Khởi tạo <audio> và Media Session một lần ───────────────────
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.playsInline = true
    audio.setAttribute('playsinline', '')
    audio.setAttribute('webkit-playsinline', '')
    audioRef.current = audio

    function onPlay() {
      setIsPlaying(true)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing'
      }
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

      // Repeat one: seek về đầu track khi gần cuối
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

    async function onError() {
      const { mix } = stateRef.current || {}
      if (!mix) return
      try {
        const saved = audio.currentTime
        const fresh = await resolveAudioUrl(mix.audio_path)
        signedUrlRef.current = fresh
        audio.src = fresh.url
        await new Promise(res => audio.addEventListener('loadedmetadata', res, { once: true }))
        audio.currentTime = saved
        if (stateRef.current.isPlaying) audio.play().catch(() => {})
      } catch (e) {
        setError(e.message)
      }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('ratechange', onRateChange)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    // Đăng ký Media Session Action Handlers
    if ('mediaSession' in navigator) {
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
      // Đặt seekbackward / seekforward là null để iOS không thay nút Trước/Sau bằng ±10s
      try { navigator.mediaSession.setActionHandler('seekbackward', null) } catch {}
      try { navigator.mediaSession.setActionHandler('seekforward', null) } catch {}
    }

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('ratechange', onRateChange)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', null)
          navigator.mediaSession.setActionHandler('pause', null)
          navigator.mediaSession.setActionHandler('previoustrack', null)
          navigator.mediaSession.setActionHandler('nexttrack', null)
          navigator.mediaSession.setActionHandler('seekto', null)
        } catch {}
      }
    }
  }, [updatePositionState, updateMediaMetadata])

  // ─── Làm mới signed URL theo giờ (chỉ áp dụng cho private URL cũ) ────
  useEffect(() => {
    if (!mix) return
    const id = setInterval(async () => {
      const ref = signedUrlRef.current
      // Public URL của R2 không bao giờ hết hạn
      if (!ref || ref.isPublic) return
      const ageMs = Date.now() - ref.createdAt
      if (ageMs < SIGNED_URL_REFRESH * 1000) return
      try {
        const fresh = await resolveAudioUrl(mix.audio_path)
        const audio = audioRef.current
        const saved = audio.currentTime
        const wasPlaying = !audio.paused
        signedUrlRef.current = fresh
        audio.src = fresh.url
        await new Promise(res => audio.addEventListener('loadedmetadata', res, { once: true }))
        audio.currentTime = saved
        if (wasPlaying) audio.play().catch(() => {})
      } catch {}
    }, 60_000) // kiểm tra mỗi phút
    return () => clearInterval(id)
  }, [mix])

  // ─── playMix: phát một mix (và nhảy tới track nếu có) ──────────
  const playMix = useCallback(async (newMix, newTracks, startTrackIdx = 0) => {
    const audio = audioRef.current
    setError('')
    setIsLoading(true)

    const isSameMix = stateRef.current.mix?.id === newMix.id
    const normalized = normalizeTracks(newTracks, newMix.duration_seconds)

    if (!isSameMix) {
      try {
        const resolved = await resolveAudioUrl(newMix.audio_path)
        signedUrlRef.current = resolved
        audio.src = resolved.url
        setMix(newMix)
        setTracks(normalized)
        setCurIdx(startTrackIdx)

        await new Promise((res, rej) => {
          audio.addEventListener('loadedmetadata', res, { once: true })
          audio.addEventListener('error', rej, { once: true })
        })
        audio.currentTime = normalized[startTrackIdx]?.start_seconds ?? 0
      } catch (e) {
        setError('Không tải được mix: ' + e.message)
        setIsLoading(false)
        return
      }
    } else {
      setTracks(normalized)
      setCurIdx(startTrackIdx)
      audio.currentTime = normalized[startTrackIdx]?.start_seconds ?? 0
    }

    updateMediaMetadata(newMix, normalized[startTrackIdx])
    updatePositionState()

    setIsLoading(false)
    try { await audio.play() } catch {}
  }, [updateMediaMetadata, updatePositionState])

  // ─── togglePlay ─────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!stateRef.current.mix) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [])

  // ─── next ───────────────────────────────────────────────────────
  const next = useCallback(() => {
    const { tracks, curIdx, repeat, mix } = stateRef.current || {}
    const audio = audioRef.current
    if (!tracks?.length) return
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
    if (!tracks?.length) return
    const curTrack = tracks[curIdx]

    // Nếu đã phát > 3s → về đầu track
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
  const seekInTrack = useCallback((trackSec) => {
    const { tracks, curIdx } = stateRef.current || {}
    const audio = audioRef.current
    if (!tracks?.length) return
    const cur = tracks[curIdx]
    audio.currentTime = Math.max(cur.start_seconds, Math.min(cur.end_seconds - 0.05, cur.start_seconds + trackSec))
    updatePositionState()
  }, [updatePositionState])

  // ─── playTrack: chạm track trong danh sách ─────────────────────
  const playTrack = useCallback((trackIdx) => {
    const { tracks, mix } = stateRef.current || {}
    const audio = audioRef.current
    if (!tracks?.length || trackIdx >= tracks.length) return
    audio.currentTime = tracks[trackIdx].start_seconds
    setCurIdx(trackIdx)
    updateMediaMetadata(mix, tracks[trackIdx])
    updatePositionState()
    if (audio.paused) audio.play().catch(() => {})
  }, [updateMediaMetadata, updatePositionState])

  // ─── cycleRepeat ─────────────────────────────────────────────────
  const cycleRepeat = useCallback(() => {
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')
  }, [])

  // Đưa các actions vào actionsRef cho Media Session handler gọi
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
    mix, tracks, curIdx, isPlaying, repeat, isLoading, error,
    playMix, togglePlay, next, prev, seekInTrack, playTrack, cycleRepeat,
  }

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}

// ─── Normalize tracks: đảm bảo có end_seconds ───────────────────────
function normalizeTracks(tracks, durationSeconds) {
  if (!tracks || tracks.length === 0) return []
  return tracks.map((t, i) => ({
    ...t,
    start_seconds: Number(t.start_seconds),
    end_seconds: i < tracks.length - 1
      ? Number(tracks[i + 1].start_seconds)
      : Number(t.end_seconds ?? durationSeconds),
  }))
}
