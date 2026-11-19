/**
 * Parse CSV tracklist theo chuẩn RFC 4180.
 * Định dạng: header name,artist,time (thứ tự cột tuỳ ý, so khớp không phân biệt hoa thường)
 * Trả về { tracks, errors, warnings }
 * tracks: [{ name, artist, start_seconds }] đã sắp xếp theo start_seconds
 */

/**
 * Parse RFC 4180 CSV → mảng các object { [header]: value }
 * Hỗ trợ: BOM, CRLF, ô có dấu nháy kép, dấu phẩy trong ô có nháy kép.
 */
function parseCSVRFC4180(text) {
  // Loại BOM
  const raw = text.replace(/^\uFEFF/, '')
  const rows = []
  let i = 0
  const len = raw.length

  function parseField() {
    if (i >= len) return ''
    if (raw[i] === '"') {
      // Ô có nháy kép
      i++ // bỏ nháy mở
      let field = ''
      while (i < len) {
        if (raw[i] === '"') {
          if (raw[i + 1] === '"') {
            field += '"'
            i += 2
          } else {
            i++ // bỏ nháy đóng
            break
          }
        } else {
          field += raw[i++]
        }
      }
      return field
    } else {
      let field = ''
      while (i < len && raw[i] !== ',' && raw[i] !== '\n' && raw[i] !== '\r') {
        field += raw[i++]
      }
      return field
    }
  }

  while (i < len) {
    const row = []
    while (true) {
      row.push(parseField())
      if (i >= len || raw[i] === '\n' || raw[i] === '\r') break
      if (raw[i] === ',') i++ // bỏ dấu phẩy
    }
    // Bỏ CRLF hoặc LF
    if (i < len && raw[i] === '\r') i++
    if (i < len && raw[i] === '\n') i++
    rows.push(row)
  }
  return rows
}

/**
 * Chuyển "HH:MM:SS", "H:MM:SS", "MM:SS" → giây (number)
 * Trả về null nếu không parse được.
 */
function parseTimeString(s) {
  const trimmed = s.trim()
  const parts = trimmed.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

/**
 * Parse ô time:
 * 1. Markdown link [HH:MM:SS](url) → lấy chữ trong []
 * 2. Chữ thuần HH:MM:SS
 * 3. Số giây nguyên
 * 4. ?t=325s hoặc &t=325 từ URL (fallback)
 * Nếu có cả chữ lẫn t= mà lệch > 1 giây → warning, ưu tiên chữ.
 */
function parseTimeCell(cell) {
  const s = cell.trim()

  // 1. Markdown link
  const mdMatch = s.match(/^\[([^\]]+)\]\(([^)]*)\)/)
  let textSeconds = null
  let urlSeconds = null
  let textStr = null

  if (mdMatch) {
    textStr = mdMatch[1]
    textSeconds = parseTimeString(textStr)
    const url = mdMatch[2]
    const tMatch = url.match(/[?&]t=(\d+)s?/)
    if (tMatch) urlSeconds = parseInt(tMatch[1], 10)
  } else {
    // 2. Thuần chữ thời gian
    const pure = parseTimeString(s)
    if (pure !== null) return { seconds: pure, warning: null }

    // 3. Số giây nguyên
    const num = Number(s)
    if (!isNaN(num) && s !== '') return { seconds: num, warning: null }

    // 4. Chỉ có URL với t=
    const urlMatch = s.match(/[?&]t=(\d+)s?/)
    if (urlMatch) return { seconds: parseInt(urlMatch[1], 10), warning: null }

    return { seconds: null, warning: null }
  }

  if (textSeconds !== null) {
    let warning = null
    if (urlSeconds !== null && Math.abs(textSeconds - urlSeconds) > 1) {
      warning = `Thời gian "${textStr}" và t=${urlSeconds}s lệch nhau; đã dùng "${textStr}".`
    }
    return { seconds: textSeconds, warning }
  }
  if (urlSeconds !== null) return { seconds: urlSeconds, warning: null }
  return { seconds: null, warning: null }
}

/**
 * Parse toàn bộ CSV tracklist.
 * @param {string} csvText  - Nội dung file CSV
 * @param {number} durationSeconds - Thời lượng file audio
 * @param {boolean} addIntro - Có thêm track "Mở đầu" nếu track đầu > 0
 * @returns {{ tracks: Array, errors: string[], warnings: string[] }}
 */
export function parseTracklist(csvText, durationSeconds, addIntro = true) {
  const errors = []
  const warnings = []

  const rows = parseCSVRFC4180(csvText)
  if (rows.length === 0) {
    errors.push('File CSV rỗng.')
    return { tracks: [], errors, warnings }
  }

  // Dòng 1 là header
  const header = rows[0].map(h => h.trim().toLowerCase())
  const nameIdx = header.indexOf('name')
  const artistIdx = header.indexOf('artist')
  const timeIdx = header.indexOf('time')

  if (nameIdx === -1) errors.push('Header thiếu cột "name".')
  if (timeIdx === -1) errors.push('Header thiếu cột "time".')
  if (errors.length) return { tracks: [], errors, warnings }

  const rawTracks = []

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]
    const lineNum = rowIdx + 1 // tính cả header

    // Bỏ dòng trống ở cuối
    if (row.every(c => c.trim() === '')) continue

    const name = (row[nameIdx] ?? '').trim()
    const artist = artistIdx !== -1 ? (row[artistIdx] ?? '').trim() : ''
    const timeCell = (row[timeIdx] ?? '').trim()

    if (!name) {
      errors.push(`Dòng ${lineNum}: thiếu tên track (cột "name").`)
      continue
    }

    const { seconds, warning } = parseTimeCell(timeCell)
    if (warning) warnings.push(`Dòng ${lineNum}: ${warning}`)

    if (seconds === null || isNaN(seconds)) {
      errors.push(`Dòng ${lineNum}: không đọc được thời điểm "${timeCell}".`)
      continue
    }

    if (seconds >= durationSeconds) {
      errors.push(
        `Dòng ${lineNum}: thời điểm ${formatTime(seconds)} vượt thời lượng file (${formatTime(durationSeconds)}).`
      )
      continue
    }

    if (durationSeconds - seconds < 1) {
      warnings.push(
        `Dòng ${lineNum}: track "${name}" bắt đầu chưa tới 1 giây trước khi kết thúc.`
      )
    }

    rawTracks.push({ name, artist, start_seconds: seconds, _line: lineNum })
  }

  // Sắp xếp theo thời gian
  rawTracks.sort((a, b) => a.start_seconds - b.start_seconds)

  // Kiểm tra trùng thời điểm
  for (let i = 0; i < rawTracks.length - 1; i++) {
    if (rawTracks[i].start_seconds === rawTracks[i + 1].start_seconds) {
      errors.push(
        `Dòng ${rawTracks[i]._line} và ${rawTracks[i + 1]._line}: hai track cùng thời điểm ${formatTime(rawTracks[i].start_seconds)}.`
      )
    }
  }

  if (errors.length) return { tracks: [], errors, warnings }

  let tracks = rawTracks.map(({ _line, ...t }) => t)

  // Thêm track "Mở đầu" nếu track đầu > 0
  if (addIntro && tracks.length > 0 && tracks[0].start_seconds > 0) {
    tracks = [
      { name: 'Mở đầu', artist: '', start_seconds: 0 },
      ...tracks,
    ]
  }

  return { tracks, errors, warnings }
}

export function formatTime(secs) {
  const s = Math.floor(secs ?? 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}
