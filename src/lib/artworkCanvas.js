/**
 * Sinh data URL 512x512 JPEG làm ảnh bìa cho Media Session / Lock screen.
 * Nếu mix có cover url thì vẽ ảnh lên canvas;
 * Nếu không thì vẽ chữ cái đầu của mix hoặc nốt nhạc trên nền đen tối giản.
 */

// Cache trong bộ nhớ để không tạo canvas liên tục
const artworkCache = new Map()

export async function getMixArtwork(mix, curTrack) {
  if (!mix) return null
  const cacheKey = `${mix.id}-${curTrack?.name || 'default'}`
  if (artworkCache.has(cacheKey)) {
    return artworkCache.get(cacheKey)
  }

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Nền đen chuẩn #000
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, 512, 512)

  // Nếu có cover_url từ Storage, load và vẽ
  if (mix.cover_url) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = mix.cover_url
      })
      ctx.drawImage(img, 0, 0, 512, 512)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      artworkCache.set(cacheKey, dataUrl)
      return dataUrl
    } catch {
      // Fallback xuống vẽ chữ nếu load ảnh lỗi
    }
  }

  // Khung viền mỏng tinh tế
  ctx.strokeStyle = '#27272a' // zinc-800
  ctx.lineWidth = 4
  ctx.strokeRect(16, 16, 480, 480)

  // Vẽ chữ cái đầu viết hoa của tên mix
  const initial = (mix.title || 'N').trim().charAt(0).toUpperCase()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 180px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initial, 256, 230)

  // Vẽ tên mix nhỏ bên dưới
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#a1a1aa' // zinc-400
  const titleText = mix.title.length > 25 ? mix.title.slice(0, 23) + '…' : mix.title
  ctx.fillText(titleText, 256, 360)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  artworkCache.set(cacheKey, dataUrl)
  return dataUrl
}
