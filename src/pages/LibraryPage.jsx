import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import { ChevronRight, Music, Play, Plus } from 'lucide-react'
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
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-xs text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      {/* Tiêu đề trang & Nút Thêm mix */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Thư viện</h1>
          <p className="mt-0.5 text-xs text-zinc-500">{mixes.length} set</p>
        </div>
        <Link to="/add-mix">
          <Button className="min-h-[44px] gap-1.5 rounded-xl px-4 font-semibold">
            <Plus size={16} />
            <span>Thêm mix</span>
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
                className="group flex items-center justify-between gap-3 py-3"
              >
                {/* Chạm vào khu vực bên trái để mở Album */}
                <button
                  onClick={() => navigate(`/mix/${mix.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {/* Icon nốt nhạc tĩnh */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-850 bg-zinc-950 text-zinc-500">
                    <Music size={20} />
                  </div>

                  {/* Thông tin set: chỉ in đậm hơn nếu đang phát */}
                  <div className="min-w-0 flex-1 pr-1">
                    <h3
                      className={[
                        'truncate text-sm',
                        isPlayingThisMix ? 'font-bold text-white' : 'font-normal text-zinc-300',
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
                    className="shrink-0 text-zinc-700 group-hover:text-zinc-400"
                  />
                </button>

                {/* Nút phát nhanh */}
                <Button
                  variant="secondary"
                  isIconOnly
                  size="sm"
                  className="h-10 w-10 shrink-0 rounded-full border border-zinc-800 text-zinc-300 hover:text-white"
                  onPress={async () => {
                    const { data } = await supabase
                      .from('tracks_timed')
                      .select('*')
                      .eq('mix_id', mix.id)
                      .order('start_seconds', { ascending: true })
                    playMix(mix, data || [], 0)
                  }}
                  aria-label={`Phát set ${mix.title}`}
                >
                  <Play size={15} fill="currentColor" />
                </Button>
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
      <Music size={36} className="text-zinc-700" />
      <div>
        <p className="text-sm font-medium text-zinc-300">Chưa có set nào</p>
        <p className="mt-1 text-xs text-zinc-500">
          Thêm set nhạc mới để bắt đầu nghe.
        </p>
      </div>
      <Link to="/add-mix">
        <Button className="mt-2 min-h-[44px]">
          <Plus size={16} />
          <span>Thêm mix đầu tiên</span>
        </Button>
      </Link>
    </div>
  )
}
