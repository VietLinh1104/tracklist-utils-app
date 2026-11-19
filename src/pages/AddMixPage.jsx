import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import {
  Upload,
  FileAudio,
  FileText,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  FileCode,
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

  // Chọn file audio
  function handleAudioChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioFile(file)
    setErrorMessage('')

    // Tự gợi ý tên mix từ tên file nếu chưa nhập
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

  // Chọn file CSV
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

  // Parse tracklist tức thì khi csvText, duration hoặc addIntro thay đổi
  const parseResult = useMemo(() => {
    if (!csvText.trim()) return null
    // Nếu chưa chọn audio thì tạm thời giả định duration đủ lớn để vẫn parse và xem trước được
    const effectiveDuration = duration !== null && duration > 0 ? duration : 86400
    return parseTracklist(csvText, effectiveDuration, addIntro)
  }, [csvText, duration, addIntro])

  const hasParseErrors = parseResult?.errors && parseResult.errors.length > 0

  // Thực hiện toàn bộ quy trình: Upload R2 -> Tạo Mix -> Lưu Tracklist
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErrorMessage('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
      setUploading(false)
      return
    }

    const ext = audioFile.name.split('.').pop().toLowerCase()
    const newMixId = crypto.randomUUID()
    const path = `${user.id}/${newMixId}.${ext}`

    // 1. Gọi Edge Function lấy Presigned PUT URL
    const { data: presignData, error: presignErr } = await supabase.functions.invoke('r2-presign', {
      body: {
        key: path,
        contentType: audioFile.type || 'audio/mpeg',
      },
    })

    if (presignErr || !presignData?.uploadUrl) {
      setErrorMessage(
        'Không lấy được URL upload Cloudflare R2: ' +
          (presignErr?.message || presignData?.error || 'Lỗi Edge Function')
      )
      setUploading(false)
      return
    }

    // 2. Upload file trực tiếp lên R2
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

    // 3. Insert mix vào database
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

    // 4. Lưu tracklist nếu có
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
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-white"
          aria-label="Quay lại"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-semibold">Thêm mix mới</h2>
          <p className="text-xs text-zinc-500">Upload audio và chia track theo CSV</p>
        </div>
      </div>

      {/* ── 1. Chọn file Audio ── */}
      <section className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">1. File audio (Mix dài)</label>
        <button
          onClick={() => audioInputRef.current?.click()}
          className="flex min-h-[84px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <FileAudio size={24} className="text-zinc-500" />
          <span className="text-sm font-medium">
            {audioFile ? audioFile.name : 'Chọn file MP3, M4A, AAC…'}
          </span>
          {duration !== null && (
            <span className="text-xs text-zinc-500">
              Thời lượng phát hiện: <strong className="text-white">{formatTime(duration)}</strong>
              {audioFile?.name?.toLowerCase().endsWith('.mp3') && (
                <span className="ml-1 text-amber-500">· Nên dùng AAC/M4A để tua chuẩn nhất</span>
              )}
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
        <label className="text-sm font-medium text-zinc-300" htmlFor="mix-title">
          2. Tên mix
        </label>
        <input
          id="mix-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Ultra Miami 2024 Set"
          className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </section>

      {/* ── 3. Nhập Tracklist (CSV) ── */}
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">3. Danh sách bài (Tracklist CSV)</label>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setCsvMode('file')}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                csvMode === 'file' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Chọn file
            </button>
            <button
              onClick={() => setCsvMode('text')}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                csvMode === 'text' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
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
              className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            >
              <FileText size={20} />
              <span className="text-xs">
                {csvFileName ? csvFileName : 'Chọn file .csv (name,artist,time)'}
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
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-700 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        )}

        <p className="text-xs text-zinc-600">
          Cột <code>time</code> hỗ trợ dạng <code>[MM:SS](url)</code> (YouTube) hoặc <code>HH:MM:SS</code>.
        </p>

        {/* Bảng xem trước chia track */}
        {parseResult && (
          <div className="mt-2 flex flex-col gap-3">
            {/* Lỗi parse */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-xl bg-red-950/40 border border-red-900/60 p-3">
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

            {/* Cảnh báo */}
            {parseResult.warnings.length > 0 && (
              <div className="rounded-xl bg-amber-950/30 border border-amber-900/50 p-3">
                <p className="text-xs font-semibold text-amber-400">Cảnh báo:</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-amber-300 space-y-0.5">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tùy chọn Mở đầu */}
            {!hasParseErrors && parseResult.tracks.length > 0 && (
              <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5">
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
            )}

            {/* Bảng track đã chia */}
            {!hasParseErrors && parseResult.tracks.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-zinc-900">
                <div className="bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-400 flex justify-between">
                  <span>Đã nhận diện {parseResult.tracks.length} track</span>
                  {duration && <span>Tổng file: {formatTime(duration)}</span>}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-950 text-zinc-500 border-b border-zinc-900">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-normal w-8">#</th>
                        <th className="px-2.5 py-2 text-left font-normal">Tên bài</th>
                        <th className="px-2.5 py-2 text-left font-normal">Nghệ sĩ</th>
                        <th className="px-2.5 py-2 text-right font-normal">Bắt đầu</th>
                        <th className="px-2.5 py-2 text-right font-normal">Thời lượng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {parseResult.tracks.map((t, i) => {
                        const nextStart =
                          i < parseResult.tracks.length - 1
                            ? parseResult.tracks[i + 1].start_seconds
                            : duration || t.start_seconds
                        const trackLen = Math.max(0, nextStart - t.start_seconds)
                        return (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="px-2.5 py-2 text-zinc-600 tabular-nums">{i + 1}</td>
                            <td className="px-2.5 py-2 font-medium text-white">{t.name}</td>
                            <td className="px-2.5 py-2 text-zinc-400 truncate max-w-[100px]">
                              {t.artist || '—'}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums text-zinc-400">
                              {formatTime(t.start_seconds)}
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums text-zinc-500">
                              {duration ? formatTime(trackLen) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Tiến trình Upload */}
      {uploading && (
        <div className="flex flex-col gap-2 rounded-xl bg-zinc-950 p-4 border border-zinc-800">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{uploadStatus}</span>
            <span className="font-semibold text-white">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-white transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Thông báo lỗi */}
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl bg-red-950/40 border border-red-900/60 p-3 text-xs text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Nút hành động chính */}
      <Button
        onPress={handleUploadAndSave}
        isDisabled={uploading || !audioFile || !title.trim() || hasParseErrors}
        fullWidth
        className="min-h-[48px] font-medium"
      >
        <Upload size={18} />
        {uploading
          ? 'Đang xử lý…'
          : parseResult && parseResult.tracks.length > 0
          ? `Lưu Mix & Chia ${parseResult.tracks.length} Track`
          : 'Lưu Mix (Chưa có tracklist)'}
      </Button>
    </div>
  )
}

// ─── Upload trực tiếp lên Cloudflare R2 qua Presigned PUT URL ────────
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
