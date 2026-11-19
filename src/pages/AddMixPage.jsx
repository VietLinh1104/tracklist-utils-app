import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  FileAudio,
  FileText,
  Upload,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseTracklist, formatTime } from '../lib/tracklist'

export default function AddMixPage() {
  const navigate = useNavigate()

  // 1. Audio
  const [audioFile, setAudioFile] = useState(null)
  const [duration, setDuration] = useState(null)
  const audioInputRef = useRef(null)

  // 2. Tên mix
  const [title, setTitle] = useState('')

  // 3. Tracklist CSV
  const [csvMode, setCsvMode] = useState('file') // 'file' | 'text'
  const [csvText, setCsvText] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [addIntro, setAddIntro] = useState(true)
  const csvInputRef = useRef(null)

  // 4. Trạng thái Upload & Lưu
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function handleAudioChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioFile(file)
    setErrorMessage('')

    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '')
      setTitle(baseName)
    }

    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      URL.revokeObjectURL(url)
    })
    audio.addEventListener('error', () => {
      setDuration(0)
      URL.revokeObjectURL(url)
    })
  }

  function handleCsvFileChange(e) {
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
    const effectiveDuration = duration !== null && duration > 0 ? duration : 86400
    return parseTracklist(csvText, effectiveDuration, addIntro)
  }, [csvText, duration, addIntro])

  const hasParseErrors = parseResult?.errors && parseResult.errors.length > 0

  async function handleUploadAndSave() {
    if (!audioFile) {
      setErrorMessage('Vui lòng chọn file audio.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Vui lòng nhập tên mix.')
      return
    }
    if (hasParseErrors) {
      setErrorMessage('Vui lòng sửa các lỗi trong tracklist trước khi lưu.')
      return
    }

    setUploading(true)
    setErrorMessage('')
    setUploadProgress(0)
    setUploadStatus('Đang xin quyền upload Cloudflare R2…')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setErrorMessage('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
      setUploading(false)
      return
    }

    const ext = audioFile.name.split('.').pop().toLowerCase()
    const newMixId = crypto.randomUUID()
    const path = `${user.id}/${newMixId}.${ext}`

    const { data: presignData, error: presignErr } = await supabase.functions.invoke(
      'r2-presign',
      {
        body: {
          key: path,
          contentType: audioFile.type || 'audio/mpeg',
        },
      }
    )

    if (presignErr || !presignData?.uploadUrl) {
      setErrorMessage(
        'Không lấy được URL upload Cloudflare R2: ' +
          (presignErr?.message || presignData?.error || 'Lỗi Edge Function')
      )
      setUploading(false)
      return
    }

    setUploadStatus('Đang upload file audio lên R2…')
    const uploadErr = await uploadToR2WithProgress(
      audioFile,
      presignData.uploadUrl,
      (pct) => setUploadProgress(pct)
    )

    if (uploadErr) {
      setErrorMessage('Upload lên R2 thất bại: ' + uploadErr)
      setUploading(false)
      return
    }

    setUploadStatus('Đang lưu thông tin mix…')
    const finalAudioPath = presignData.publicUrl || path
    const { error: insertErr } = await supabase.from('mixes').insert({
      id: newMixId,
      title: title.trim(),
      audio_path: finalAudioPath,
      mime_type: audioFile.type || 'audio/mpeg',
      size_bytes: audioFile.size,
      duration_seconds: duration ?? 0,
    })

    if (insertErr) {
      setErrorMessage('Lưu thông tin mix thất bại: ' + insertErr.message)
      setUploading(false)
      return
    }

    if (parseResult && parseResult.tracks.length > 0) {
      setUploadStatus('Đang chia và lưu các track…')
      const p_tracks = parseResult.tracks.map((t) => ({
        name: t.name,
        artist: t.artist,
        start_seconds: t.start_seconds,
      }))

      const { error: rpcErr } = await supabase.rpc('replace_tracks', {
        p_mix_id: newMixId,
        p_tracks,
      })

      if (rpcErr) {
        setErrorMessage('Tạo mix thành công nhưng lưu tracklist lỗi: ' + rpcErr.message)
        setUploading(false)
        return
      }
    }

    setUploading(false)
    navigate('/')
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-12">
      {/* Header điều hướng */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] -ml-2 gap-1 text-zinc-400 hover:text-white"
          onPress={() => navigate('/')}
        >
          <ChevronLeft size={18} />
          <span>Thư viện</span>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Thêm mix mới</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Upload file âm thanh lên Cloudflare R2 và chia track theo CSV
        </p>
      </div>

      {/* ── 1. Chọn file Audio ── */}
      <section className="flex flex-col gap-2.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          1. FILE ÂM THANH (SET DÀI)
        </label>
        <button
          onClick={() => audioInputRef.current?.click()}
          className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-zinc-400 transition-all hover:border-zinc-600 hover:bg-zinc-900/30 active:scale-[0.99]"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <FileAudio size={22} />
          </div>
          <span className="text-sm font-medium text-white">
            {audioFile ? audioFile.name : 'Chạm để chọn file MP3, M4A, AAC…'}
          </span>
          {duration !== null && (
            <span className="text-xs text-zinc-500 font-medium">
              Thời lượng phát hiện:{' '}
              <strong className="text-white font-mono">{formatTime(duration)}</strong>
            </span>
          )}
        </button>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioChange}
        />
      </section>

      {/* ── 2. Tên mix ── */}
      <section className="flex flex-col gap-2">
        <label
          className="text-xs font-semibold uppercase tracking-wider text-zinc-400"
          htmlFor="mix-title"
        >
          2. TÊN SET / ALBUM
        </label>
        <input
          id="mix-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: DJ Set Summer 2024"
          className="min-h-[48px] w-full rounded-2xl border border-zinc-850 bg-zinc-950 px-4 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </section>

      {/* ── 3. Nhập Tracklist (CSV) ── */}
      <section className="flex flex-col gap-3 rounded-3xl border border-zinc-850 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            3. TRACKLIST (CSV)
          </label>
          <div className="flex rounded-xl bg-zinc-900 p-0.5 text-xs">
            <button
              onClick={() => setCsvMode('file')}
              className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                csvMode === 'file'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Chọn file
            </button>
            <button
              onClick={() => setCsvMode('text')}
              className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                csvMode === 'text'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Dán text
            </button>
          </div>
        </div>

        {csvMode === 'file' ? (
          <div>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex min-h-[76px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-800 bg-black text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 active:scale-[0.99]"
            >
              <FileText size={20} />
              <span className="text-xs font-medium">
                {csvFileName ? csvFileName : 'Chọn file CSV (cột name,artist,time)'}
              </span>
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFileChange}
            />
          </div>
        ) : (
          <div>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`name,artist,time\nShooting Stars,Bag Raiders,[00:05:25](url)\nDance,ARTBAT,00:23:07`}
              className="w-full rounded-2xl border border-zinc-850 bg-black p-3.5 font-mono text-xs text-white placeholder-zinc-700 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        )}

        {/* Bảng xem trước chia track */}
        {parseResult && (
          <div className="mt-2 flex flex-col gap-3">
            {parseResult.errors.length > 0 && (
              <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <AlertCircle size={14} /> Có {parseResult.errors.length} lỗi trong file CSV:
                </p>
                <ul className="mt-1 list-disc pl-4 text-xs text-red-300 space-y-0.5">
                  {parseResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {!hasParseErrors && parseResult.tracks.length > 0 && (
              <>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={addIntro}
                    onChange={(e) => setAddIntro(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-white"
                  />
                  <span className="text-xs text-zinc-300">
                    Tự động thêm track "Mở đầu" (từ 0:00 tới bài đầu tiên)
                  </span>
                </label>

                <div className="overflow-hidden rounded-2xl border border-zinc-850">
                  <div className="flex justify-between bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-400">
                    <span>ĐÃ NHẬN DIỆN {parseResult.tracks.length} TRACK</span>
                    {duration && <span>TỔNG FILE: {formatTime(duration)}</span>}
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b border-zinc-900 bg-zinc-950 text-zinc-500">
                        <tr>
                          <th className="w-8 px-3 py-2 text-left font-normal">#</th>
                          <th className="px-3 py-2 text-left font-normal">Tên bài</th>
                          <th className="px-3 py-2 text-left font-normal">Nghệ sĩ</th>
                          <th className="px-3 py-2 text-right font-normal">Bắt đầu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {parseResult.tracks.map((t, i) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="px-3 py-2 text-zinc-600 font-mono tabular-nums">
                              {i + 1}
                            </td>
                            <td className="px-3 py-2 font-medium text-white">{t.name}</td>
                            <td className="max-w-[100px] truncate px-3 py-2 text-zinc-400">
                              {t.artist || '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-500">
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
      </section>

      {/* Thanh tiến trình Upload */}
      {uploading && (
        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg">
          <div className="flex justify-between text-xs text-zinc-400 font-medium">
            <span>{uploadStatus}</span>
            <span className="font-mono font-bold text-white">{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-850">
            <div
              className="h-full bg-white transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Thông báo lỗi */}
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-900/60 bg-red-950/40 p-3.5 text-xs text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Nút hành động chính bằng HeroUI Button */}
      <Button
        onPress={handleUploadAndSave}
        isDisabled={uploading || !audioFile || !title.trim() || hasParseErrors}
        fullWidth
        className="min-h-[50px] rounded-2xl font-semibold shadow-xl active:scale-95"
      >
        <Upload size={18} />
        <span>
          {uploading
            ? 'Đang tải lên & lưu…'
            : parseResult && parseResult.tracks.length > 0
            ? `Lưu Set & Chia ${parseResult.tracks.length} Track`
            : 'Lưu Set (Chưa có tracklist)'}
        </span>
      </Button>
    </div>
  )
}

function uploadToR2WithProgress(file, uploadUrl, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(null)
      } else {
        let msg = `HTTP ${xhr.status}`
        try {
          msg += ': ' + xhr.responseText
        } catch {}
        resolve(msg)
      }
    })

    xhr.addEventListener('error', () =>
      resolve('Lỗi mạng khi upload lên R2 (kiểm tra CORS của R2).')
    )
    xhr.send(file)
  })
}
