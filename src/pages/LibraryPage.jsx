import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import { ChevronRight, Disc3, Music, Play, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import { formatTime } from '../lib/tracklist'

export default function LibraryPage() {
  const [mixes, setMixes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { playMix, mix: activeMix } = usePlayer()

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
    return <div className="flex items-center justify-center py-24 text-zinc-500 text-sm">Đang tải thư viện…</div>
  }

  if (error) {
    return <div className="rounded-xl bg-zinc-900 p-4 text-xs text-red-400">{error}</div>
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Thư viện</h2>
          <p className="text-xs text-zinc-500">{mixes.length} set nhạc</p>
        </div>
        <Link to="/add-mix">
          <Button className="min-h-[44px] gap-1.5" size="sm">
            <Plus size={16} />
            Thêm mix
          </Button>
        </Link>
      </div>

      {mixes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col divide-y divide-zinc-900 border-t border-b border-zinc-900">
          {mixes.map((mix) => {
            const isPlayingThisMix = activeMix?.id === mix.id
            return (
              <div
                key={mix.id}
                className="group flex items-center justify-between gap-3 py-3 transition-colors hover:bg-zinc-950/60"
              >
                {/* Chạm vào khu vực bên trái để mở Album xem chi tiết track */}
                <button
                  onClick={() => navigate(`/mix/${mix.id}`)}
                  className="flex flex-1 items-center gap-3.5 text-left overflow-hidden min-h-[50px]"
                >
                  {/* Icon đĩa nhạc */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-850 bg-zinc-950 shadow-inner">
                    <Disc3
                      size={22}
                      className={
                        isPlayingThisMix
                          ? 'text-white animate-[spin_8s_linear_infinite]'
                          : 'text-zinc-600'
                      }
                    />
                  </div>

                  {/* Thông tin Set */}
                  <div className="min-w-0 flex-1">
                    <h3
                      className={[
                        'truncate text-sm font-medium',
                        isPlayingThisMix ? 'text-white font-semibold' : 'text-zinc-200',
                      ].join(' ')}
                    >
                      {mix.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {mix.trackCount > 0 ? `${mix.trackCount} bài` : 'Chưa chia bài'} ·{' '}
                      {formatTime(mix.duration_seconds)}
                    </p>
                  </div>

                  <ChevronRight
                    size={16}
                    className="shrink-0 text-zinc-700 transition-transform group-hover:translate-x-0.5"
                  />
                </button>

                {/* Nút phát nhanh cả set */}
                <button
                  onClick={async () => {
                    // Lấy tracks rồi phát
                    const { data } = await supabase
                      .from('tracks_timed')
                      .select('*')
                      .eq('mix_id', mix.id)
                      .order('start_seconds', { ascending: true })
                    playMix(mix, data || [], 0)
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white hover:bg-zinc-900"
                  aria-label={`Phát set ${mix.title}`}
                  title="Phát ngay"
                >
                  <Play size={16} fill="currentColor" />
                </button>
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
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <Music size={42} className="text-zinc-700" />
      <div>
        <p className="text-zinc-300 font-medium">Chưa có set nào trong thư viện.</p>
        <p className="mt-1 text-xs text-zinc-500">
          Tải lên set nhạc đầu tiên và chia tracklist để bắt đầu nghe.
        </p>
      </div>
      <Link to="/add-mix">
        <Button className="mt-2 min-h-[44px]">
          <Plus size={16} />
          Thêm mix đầu tiên
        </Button>
      </Link>
    </div>
  )
}
