import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import { ChevronRight, Disc3, Music, Play, Plus, Radio } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import { formatTime } from '../lib/tracklist'

export default function LibraryPage() {
  const [mixes, setMixes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { playMix, mix: activeMix, isPlaying } = usePlayer()

  async function loadLibrary() {
    setLoading(true)
    setError('')

    const { data: mixData, error: mixErr } = await supabase
      .from('mixes')
      .select('*')
      .order('created_at', { ascending: false })

    if (mixErr) {
      setError('Không tải được danh sách. ' + mixErr.message)
      setLoading(false)
      return
    }

    if (!mixData || mixData.length === 0) {
      setMixes([])
      setLoading(false)
      return
    }

    // Đếm số lượng track của mỗi mix
    const ids = mixData.map((m) => m.id)
    const { data: trackData } = await supabase
      .from('tracks')
      .select('mix_id')
      .in('mix_id', ids)

    const trackCounts = {}
    ;(trackData ?? []).forEach((t) => {
      trackCounts[t.mix_id] = (trackCounts[t.mix_id] || 0) + 1
    })

    setMixes(mixData.map((m) => ({ ...m, trackCount: trackCounts[m.id] || 0 })))
    setLoading(false)
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
        Đang tải thư viện…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-xs text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      {/* Tiêu đề trang & Nút Thêm mix */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Thư viện</h1>
          <p className="mt-0.5 text-xs text-zinc-400">
            {mixes.length} set nhạc lưu trên đám mây
          </p>
        </div>
        <Link to="/add-mix">
          <Button
            className="min-h-[44px] gap-2 rounded-xl px-4 font-semibold shadow-md active:scale-95"
          >
            <Plus size={18} />
            <span>Thêm mix</span>
          </Button>
        </Link>
      </div>

      {mixes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {mixes.map((mix) => {
            const isPlayingThisMix = activeMix?.id === mix.id
            return (
              <div
                key={mix.id}
                className={[
                  'group relative flex items-center justify-between gap-3.5 rounded-2xl border p-3.5 transition-all active:scale-[0.99]',
                  isPlayingThisMix
                    ? 'border-zinc-700 bg-zinc-900/70 shadow-lg'
                    : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-800 hover:bg-zinc-900/40',
                ].join(' ')}
              >
                {/* Vùng bấm mở Album */}
                <button
                  onClick={() => navigate(`/mix/${mix.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                >
                  {/* Bìa đĩa vinyl nhỏ */}
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black shadow-md">
                    <Disc3
                      size={26}
                      className={
                        isPlayingThisMix && isPlaying
                          ? 'text-white animate-[spin_8s_linear_infinite]'
                          : 'text-zinc-500'
                      }
                    />
                    {isPlayingThisMix && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                      </span>
                    )}
                  </div>

                  {/* Thông tin set */}
                  <div className="min-w-0 flex-1 pr-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={[
                          'truncate text-sm font-semibold',
                          isPlayingThisMix ? 'text-white' : 'text-zinc-200',
                        ].join(' ')}
                      >
                        {mix.title}
                      </h3>
                      {isPlayingThisMix && (
                        <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Đang nghe
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {mix.trackCount > 0 ? `${mix.trackCount} bài` : 'Chưa chia bài'} ·{' '}
                      {formatTime(mix.duration_seconds)}
                    </p>
                  </div>
                </button>

                {/* Cụm nút bên phải */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="secondary"
                    isIconOnly
                    className="h-11 w-11 rounded-full border border-zinc-800 text-zinc-300 transition-colors hover:text-white active:scale-90"
                    onPress={async () => {
                      const { data } = await supabase
                        .from('tracks_timed')
                        .select('*')
                        .eq('mix_id', mix.id)
                        .order('start_seconds', { ascending: true })
                      playMix(mix, data || [], 0)
                    }}
                    aria-label={`Phát ngay ${mix.title}`}
                  >
                    <Play size={16} fill="currentColor" />
                  </Button>

                  <button
                    onClick={() => navigate(`/mix/${mix.id}`)}
                    className="flex h-11 w-8 items-center justify-center text-zinc-600 transition-colors group-hover:text-zinc-400"
                    aria-label="Xem chi tiết"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-zinc-850 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-500">
        <Music size={28} />
      </div>
      <div>
        <p className="text-base font-semibold text-zinc-200">
          Chưa có set nào trong thư viện
        </p>
        <p className="mt-1 max-w-xs text-xs text-zinc-500 leading-relaxed">
          Tải lên file mix dài đầu tiên và dán danh sách bài (CSV) để bắt đầu thưởng thức.
        </p>
      </div>
      <Link to="/add-mix">
        <Button className="mt-2 min-h-[44px] gap-2 rounded-xl px-5 font-semibold">
          <Plus size={18} />
          <span>Thêm mix đầu tiên</span>
        </Button>
      </Link>
    </div>
  )
}
