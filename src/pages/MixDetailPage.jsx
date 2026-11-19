import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Modal } from '@heroui/react'
import {
  AlertCircle,
  ChevronLeft,
  ListPlus,
  Music,
  Play,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import { parseTracklist, formatTime } from '../lib/tracklist'

export default function MixDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { playMix, mix: activeMix, curIdx, playTrack } = usePlayer()

  const [mix, setMix] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditingTracklist, setIsEditingTracklist] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isActiveMix = activeMix?.id === id

  async function loadMixData() {
    setLoading(true)
    setError('')

    const { data: mixData, error: mixErr } = await supabase
      .from('mixes')
      .select('*')
      .eq('id', id)
      .single()

    if (mixErr || !mixData) {
      setError('Không tìm thấy set nhạc này: ' + (mixErr?.message || ''))
      setLoading(false)
      return
    }

    setMix(mixData)

    const { data: trackData, error: trackErr } = await supabase
      .from('tracks_timed')
      .select('*')
      .eq('mix_id', id)
      .order('start_seconds', { ascending: true })

    if (!trackErr && trackData) {
      setTracks(trackData)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadMixData()
  }, [id])

  async function handleDeleteMix() {
    if (!window.confirm(`Bạn có chắc muốn xoá set "${mix?.title}" không?`)) return
    setIsDeleting(true)
    try {
      const { error: delErr } = await supabase.from('mixes').delete().eq('id', id)
      if (delErr) throw delErr
      navigate('/')
    } catch (err) {
      alert('Không xoá được set: ' + err.message)
      setIsDeleting(false)
    }
  }

  function handlePlayAll() {
    if (!mix) return
    playMix(mix, tracks, 0)
  }

  function handlePlayTrack(idx) {
    if (!mix) return
    if (isActiveMix) {
      playTrack(idx)
    } else {
      playMix(mix, tracks, idx)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
        Đang tải thông tin set…
      </div>
    )
  }

  if (error || !mix) {
    return (
      <div className="flex flex-col gap-4 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex w-fit items-center gap-1 text-xs text-zinc-400 hover:text-white"
        >
          <ChevronLeft size={16} /> Quay lại Thư viện
        </button>
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-xs text-red-300">
          {error || 'Không tìm thấy dữ liệu.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-8">
      {/* Header điều hướng */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] -ml-2 gap-1 text-zinc-400 hover:text-white"
          onPress={() => navigate('/')}
        >
          <ChevronLeft size={18} />
          <span>Thư viện</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[40px] gap-1.5 rounded-xl border border-zinc-800 text-xs text-zinc-300 hover:text-white"
            onPress={() => setIsEditingTracklist(true)}
          >
            <ListPlus size={15} />
            <span>Sửa tracklist</span>
          </Button>

          <Button
            variant="danger-soft"
            isIconOnly
            size="sm"
            className="h-10 w-10 rounded-xl"
            onPress={handleDeleteMix}
            isDisabled={isDeleting}
            aria-label="Xoá set này"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Ảnh bìa tĩnh & Tiêu đề */}
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Khung bìa nốt nhạc tĩnh */}
        <div className="flex aspect-square w-40 items-center justify-center rounded-2xl border border-zinc-850 bg-zinc-950 shadow-md">
          <Music size={44} className="text-zinc-600" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{mix.title}</h1>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            {tracks.length} bài · {formatTime(mix.duration_seconds)}
          </p>
        </div>

        {/* Nút phát toàn bộ */}
        <Button
          onPress={handlePlayAll}
          className="min-h-[46px] min-w-[190px] gap-2 rounded-full font-semibold shadow-md active:scale-95"
        >
          <Play size={18} fill="currentColor" />
          <span>Phát toàn bộ set</span>
        </Button>
      </div>

      {/* Danh sách các track bên trong */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-[11px] font-medium text-zinc-500 uppercase">
          <span>DANH SÁCH BÀI ({tracks.length})</span>
          <span>BẮT ĐẦU</span>
        </div>

        {tracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-850 p-8 text-center">
            <p className="text-xs text-zinc-400">Set này chưa có danh sách bài.</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onPress={() => setIsEditingTracklist(true)}
            >
              Nhập file CSV ngay
            </Button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-900">
            {tracks.map((track, i) => {
              const isCurrentPlaying = isActiveMix && curIdx === i
              return (
                <button
                  key={track.id ?? i}
                  onClick={() => handlePlayTrack(i)}
                  className={[
                    'flex min-h-[50px] w-full items-center gap-3 py-2.5 text-left transition-colors',
                    isCurrentPlaying ? 'text-white' : 'text-zinc-400 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {/* Số thứ tự: chỉ in đậm hơn nếu đang phát */}
                  <span
                    className={[
                      'w-6 shrink-0 text-xs font-mono tabular-nums',
                      isCurrentPlaying ? 'font-bold text-white' : 'text-zinc-600',
                    ].join(' ')}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Tên bài & Nghệ sĩ */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'truncate text-sm',
                        isCurrentPlaying ? 'font-bold text-white' : 'font-normal',
                      ].join(' ')}
                    >
                      {track.name}
                    </p>
                    {track.artist && (
                      <p
                        className={[
                          'truncate text-xs',
                          isCurrentPlaying ? 'text-zinc-300' : 'text-zinc-600',
                        ].join(' ')}
                      >
                        {track.artist}
                      </p>
                    )}
                  </div>

                  {/* Thời gian bắt đầu */}
                  <span
                    className={[
                      'shrink-0 text-xs font-mono tabular-nums',
                      isCurrentPlaying ? 'text-zinc-300' : 'text-zinc-600',
                    ].join(' ')}
                  >
                    {formatTime(track.start_seconds)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal sửa / chia tracklist CSV */}
      {isEditingTracklist && (
        <EditTracklistModal
          mix={mix}
          isOpen={isEditingTracklist}
          onClose={() => setIsEditingTracklist(false)}
          onSuccess={() => {
            setIsEditingTracklist(false)
            loadMixData()
          }}
        />
      )}
    </div>
  )
}

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
        <Modal.Dialog className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div>
              <h3 className="text-base font-semibold text-white">Cập nhật Tracklist CSV</h3>
              <p className="max-w-[320px] truncate text-xs text-zinc-500">{mix.title}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-white"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-400">
                Dán nội dung CSV hoặc chọn file:
              </label>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`name,artist,time\nWhere's Your Head At,Basement Jaxx,[00:03:44](url)\nShooting Stars,Bag Raiders,00:05:25`}
                className="w-full rounded-xl border border-zinc-850 bg-black p-3 font-mono text-xs text-white placeholder-zinc-700 focus:border-zinc-500 focus:outline-none"
              />
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-zinc-400 underline hover:text-white"
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
                <span className="text-zinc-600">
                  Thời lượng: {formatTime(mix.duration_seconds)}
                </span>
              </div>
            </div>

            {parseResult && (
              <div className="flex flex-col gap-3">
                {parseResult.errors.length > 0 && (
                  <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <AlertCircle size={14} /> Có {parseResult.errors.length} lỗi:
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-red-300 space-y-0.5">
                      {parseResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!hasErrors && parseResult.tracks.length > 0 && (
                  <>
                    <label className="flex cursor-pointer items-center gap-2">
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
                      <div className="bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400">
                        Đã chia được {parseResult.tracks.length} track:
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-zinc-900">
                            {parseResult.tracks.map((t, i) => (
                              <tr key={i} className="hover:bg-zinc-900/40">
                                <td className="w-8 px-2.5 py-2 text-zinc-600 tabular-nums">
                                  {i + 1}
                                </td>
                                <td className="px-2.5 py-2 font-medium text-white">{t.name}</td>
                                <td className="max-w-[100px] truncate px-2.5 py-2 text-zinc-400">
                                  {t.artist || '—'}
                                </td>
                                <td className="px-2.5 py-2 text-right font-mono tabular-nums text-zinc-500">
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
              <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300">
                {saveError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-900 pt-3">
            <Button variant="secondary" size="sm" onPress={onClose} className="rounded-xl">
              Hủy
            </Button>
            <Button
              size="sm"
              className="rounded-xl font-semibold"
              onPress={handleSave}
              isDisabled={saving || !parseResult || hasErrors || parseResult.tracks.length === 0}
            >
              {saving ? 'Đang lưu…' : `Lưu ${parseResult?.tracks?.length || 0} track`}
            </Button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
