// Cài đặt tham chiếu cho skill mix-tracklist-csv. Chạy được trong trình duyệt và Node.
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function clock(x) {
  x = x.trim();
  if (/^\d+(\.\d+)?$/.test(x)) return +x;
  const p = x.split(':');
  if (p.length < 2 || p.length > 3 || p.some((v) => !/^\d+(\.\d+)?$/.test(v))) return null;
  const n = p.map(Number);
  if (n.slice(1).some((v) => v >= 60)) return null;
  return n.reduce((a, v) => a * 60 + v, 0);
}

function parseTime(raw) {
  const s = String(raw).trim(), warn = [];
  const br = s.match(/^\[([^\]]*)\]/);
  const label = br ? br[1] : (/[()]|https?:/.test(s) ? null : s);
  let sec = label != null ? clock(label) : null;
  const t = s.match(/[?&]t=(\d+)s?\b/);
  if (sec == null && t) sec = +t[1];
  else if (sec != null && t && Math.abs(sec - +t[1]) > 1) warn.push(`chữ ${label} lệch với t=${t[1]}s, dùng ${label}`);
  return { sec, warn };
}

// rows: kết quả parseCSV. duration: giây. opts.intro: thêm đoạn "Mở đầu" nếu track đầu > 0.
function buildTracks(rows, duration, opts = {}) {
  const { intro = true, introName = 'Mở đầu' } = opts;
  const errors = [], warnings = [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  if (col('name') < 0 || col('time') < 0) return { tracks: [], errors: ['Thiếu cột name hoặc time ở dòng 1'], warnings };
  const list = [];
  rows.slice(1).forEach((r, k) => {
    const line = k + 2;
    const name = (r[col('name')] || '').trim();
    const artist = col('artist') >= 0 ? (r[col('artist')] || '').trim() : '';
    const { sec, warn } = parseTime(r[col('time')] || '');
    warn.forEach((w) => warnings.push(`Dòng ${line}: ${w}`));
    if (!name) errors.push(`Dòng ${line}: thiếu name`);
    if (sec == null) errors.push(`Dòng ${line}: không đọc được time "${r[col('time')] || ''}"`);
    else if (sec >= duration) errors.push(`Dòng ${line}: time ${sec}s vượt thời lượng file ${Math.floor(duration)}s`);
    else if (duration - sec < 1) warnings.push(`Dòng ${line}: chỉ còn dưới 1 giây tới cuối file`);
    if (name && sec != null) list.push({ name, artist, start: sec, line });
  });
  list.sort((a, b) => a.start - b.start);
  for (let i = 1; i < list.length; i++)
    if (list[i].start === list[i - 1].start) errors.push(`Dòng ${list[i].line} trùng thời điểm với dòng ${list[i - 1].line}`);
  if (intro && list.length && list[0].start > 0) list.unshift({ name: introName, artist: '', start: 0, line: 0 });
  list.forEach((t, i) => { t.position = i; t.end = i + 1 < list.length ? list[i + 1].start : duration; });
  return { tracks: list, errors, warnings };
}

if (typeof module !== 'undefined') module.exports = { parseCSV, parseTime, buildTracks, clock };
