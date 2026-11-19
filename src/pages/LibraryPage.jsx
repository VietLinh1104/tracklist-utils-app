import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal } from '@heroui/react'
import {
  AlertCircle,
  ChevronDown,
  FileText,
  ListPlus,
  Music,
  Play,
  Plus,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import { parseTracklist, formatTime } from '../lib/tracklist'

export default function LibraryPage() {
  const [mixes, setMixes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingMix, setEditingMix] = useState(null)

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
      .from('tracks_timed')
      .select('*')
      .in('mix_id', ids)
      .order('start_seconds', { ascending: true })

    const tracksByMix = {}
      ; (trackData ?? []).forEach((t) => {
        if (!tracksByMix[t.mix_id]) tracksByMix[t.mix_id] = []
        tracksByMix[t.mix_id].push(t)
      })

    setMixes(mixData.map((m) => ({ ...m, tracks: tracksByMix[m.id] ?? [] })))
    setLoading(false)
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-zinc-500">Đang tải…</div>
  }

  if (error) {
    return <div className="rounded-lg bg-zinc-900 p-4 text-sm text-red-400">{error}</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Thư viện</h2>
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
        <div className="flex flex-col gap-10">
          {mixes.map((mix) => (
            <MixCard
              key={mix.id}
              mix={mix}
              onEditTracklist={() => setEditingMix(mix)}
            />
          ))}
        </div>
      )}

      {/* Modal sửa / chia tracklist cho mix đã có */}
      {editingMix && (
        <EditTracklistModal
          mix={editingMix}
          isOpen={!!editingMix}
          onClose={() => setEditingMix(null)}
          onSuccess={() => {
            setEditingMix(null)
            loadLibrary()
          }}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <Music size={40} className="text-zinc-700" />
      <div>
        <p className="text-zinc-400">Chưa có mix nào.</p>
        <p className="mt-1 text-sm text-zinc-600">
          Bấm <strong className="text-zinc-400">Thêm mix</strong> để bắt đầu.
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

function MixCard({ mix, onEditTracklist }) {
  const { playMix, mix: activeMix, curIdx, playTrack } = usePlayer()
  const isActiveMix = activeMix?.id === mix.id

  function handlePlayMix() {
    playMix(mix, mix.tracks, 0)
  }

  function handlePlayTrack(idx) {
    if (isActiveMix) {
      playTrack(idx)
    } else {
      playMix(mix, mix.tracks, idx)
    }
  }

  return (
    <section>
      {/* Header mix + nút hành động */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium leading-tight">{mix.title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {mix.tracks.length} track · {formatTime(mix.duration_seconds)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditTracklist}
            className="flex h-10 px-3 items-center gap-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="Nhập / Sửa tracklist"
          >
            <ListPlus size={15} />
            <span>Tracklist</span>
          </button>

          <button
            onClick={handlePlayMix}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-white hover:bg-zinc-900"
            aria-label={`Phát ${mix.title}`}
          >
            <Play size={18} fill="white" />
          </button>
        </div>
      </div>

      {/* Danh sách track */}
      {mix.tracks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center">
          <p className="text-xs text-zinc-500">Mix này chưa có tracklist.</p>
          <button
            onClick={onEditTracklist}
            className="mt-2 text-xs font-medium text-white underline hover:text-zinc-300"
          >
            Nhập file CSV để chia track ngay
          </button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-900">
          {mix.tracks.map((track, i) => {
            const isActiveTrack = isActiveMix && curIdx === i
            return (
              <li key={track.id ?? i}>
                <button
                  onClick={() => handlePlayTrack(i)}
                  className={[
                    'flex w-full items-baseline gap-3 border-l-2 py-2.5 pl-2 text-left transition-colors',
                    isActiveTrack
                      ? 'border-white'
                      : 'border-transparent hover:border-zinc-700',
                  ].join(' ')}
                >
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                    {formatTime(track.start_seconds)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'truncate text-sm',
                        isActiveTrack ? 'text-white' : 'text-zinc-300',
                      ].join(' ')}
                    >
                      {track.name}
                    </p>
                    {track.artist && (
                      <p className="truncate text-xs text-zinc-500">{track.artist}</p>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── Modal nhập / cập nhật Tracklist CSV cho mix ────────────────────
function EditTracklistModal({ mix, isOpen, onClose, onSuccess }) {
  const [csvText, setCsvText] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [addIntro, setAddIntro] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCsvText(ev.target.result || '')
    }
    reader.readAsText(file, 'utf-8')
  }

  const parseResult = useMemo(() => {
    if (!csvText.trim()) return null
    return parseTracklist(csvText, mix.duration_seconds || 86400, addIntro)
  }, [csvText, mix.duration_seconds, addIntro])

  const hasErrors = parseResult?.errors && parseResult.errors.length > 0

  async function handleSave() {
    if (!parseResult || hasErrors || parseResult.tracks.length === 0) return
    setSaving(true)
    setSaveError('')

    const p_tracks = parseResult.tracks.map((t) => ({
      name: t.name,
      artist: t.artist,
      start_seconds: t.start_seconds,
    }))

    const { error } = await supabase.rpc('replace_tracks', {
      p_mix_id: mix.id,
      p_tracks,
    })

    setSaving(false)
    if (error) {
      setSaveError('Lưu tracklist thất bại: ' + error.message)
      return
    }
    onSuccess()
  }

  return (
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        variant="opaque"
      >
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="flex flex-col bg-zinc-950 text-white border border-zinc-800 rounded-2xl p-5 max-w-lg w-full max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <div>
                <h3 className="text-base font-semibold">Cập nhật Tracklist CSV</h3>
                <p className="text-xs text-zinc-500 truncate max-w-[320px]">{mix.title}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
              {/* Chọn file hoặc dán */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-400">Dán nội dung CSV hoặc chọn file:</label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`name,artist,time\nWhere's Your Head At,Basement Jaxx,[00:03:44](url)\nShooting Stars,Bag Raiders,00:05:25`}
                  className="w-full rounded-xl border border-zinc-800 bg-black p-3 font-mono text-xs text-white placeholder-zinc-700 focus:border-zinc-500 focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-zinc-400 hover:text-white underline"
                  >
                    {csvFileName ? `Đã chọn: ${csvFileName}` : 'Hoặc tải lên từ file .csv'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="text-xs text-zinc-600">Độ dài mix: {formatTime(mix.duration_seconds)}</span>
                </div>
              </div>

              {/* Bảng xem trước */}
              {parseResult && (
                <div className="flex flex-col gap-3">
                  {parseResult.errors.length > 0 && (
                    <div className="rounded-xl bg-red-950/40 border border-red-900/60 p-3">
                      <p className="text-xs font-semibold text-red-400 flex items-center gap-1">
                        <AlertCircle size={14} /> Có {parseResult.errors.length} lỗi:
                      </p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-red-300">
                        {parseResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!hasErrors && parseResult.tracks.length > 0 && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addIntro}
                          onChange={(e) => setAddIntro(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-white"
                        />
                        <span className="text-xs text-zinc-300">
                          Thêm track "Mở đầu" (từ 0:00 tới bài đầu tiên)
                        </span>
                      </label>

                      <div className="overflow-hidden rounded-xl border border-zinc-850">
                        <div className="bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
                          Đã chia được {parseResult.tracks.length} track:
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-zinc-900">
                              {parseResult.tracks.map((t, i) => (
                                <tr key={i} className="hover:bg-zinc-900/40">
                                  <td className="px-2.5 py-1.5 text-zinc-600 w-8">{i + 1}</td>
                                  <td className="px-2.5 py-1.5 font-medium text-white">{t.name}</td>
                                  <td className="px-2.5 py-1.5 text-zinc-400 truncate max-w-[90px]">
                                    {t.artist || '—'}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right tabular-nums text-zinc-500">
                                    {formatTime(t.start_seconds)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {saveError && (
                <div className="rounded-xl bg-red-950/40 border border-red-900/60 p-3 text-xs text-red-300">
                  {saveError}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-850 pt-3 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onPress={onClose}>
                Hủy
              </Button>
              <Button
                size="sm"
                onPress={handleSave}
                isDisabled={saving || !parseResult || hasErrors || parseResult.tracks.length === 0}
              >
                {saving ? 'Đang lưu…' : `Lưu ${parseResult?.tracks?.length || 0} track`}
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
    </Modal.Backdrop >
  )
}
