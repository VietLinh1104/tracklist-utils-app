import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  // Hiện lỗi rõ ràng thay vì để app trắng trang
  document.getElementById('root').innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100vh;background:#000;color:#fff;font-family:system-ui;padding:2rem;text-align:center;
    ">
      <h1 style="font-size:1.25rem;margin-bottom:1rem;">⚠️ Thiếu cấu hình Supabase</h1>
      <p style="color:#999;max-width:380px;line-height:1.6;">
        Tạo file <code style="background:#111;padding:2px 6px;border-radius:4px;">.env.local</code>
        với hai biến:<br/>
        <code style="display:block;margin-top:0.5rem;background:#111;padding:8px;border-radius:4px;text-align:left;">
          VITE_SUPABASE_URL=https://…supabase.co<br/>
          VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
        </code>
      </p>
      <p style="color:#666;margin-top:1rem;font-size:0.875rem;">Khởi động lại dev server sau khi thêm biến.</p>
    </div>
  `
  throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(url, key)
