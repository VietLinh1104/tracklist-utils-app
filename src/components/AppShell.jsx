import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { LogOut, Music } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import MiniPlayer from './MiniPlayer'
import FullPlayer from './FullPlayer'

export default function AppShell() {
  const { mix } = usePlayer()
  const [fullOpen, setFullOpen] = useState(false)

  async function handleLogout() {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      await supabase.auth.signOut()
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-black text-white antialiased"
      style={{ minHeight: '100dvh' }}
    >
      {/* Header kính mờ tĩnh, tối giản */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-900 bg-black/90 px-4 backdrop-blur-md"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: '8px',
          minHeight: '56px',
        }}
      >
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-white">
            <Music size={14} />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">Nhạc</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-white"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* Nội dung trang */}
      <main
        className="flex-1 px-4 py-5"
        style={{
          paddingBottom: mix
            ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)'
            : 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <Outlet />
      </main>

      {/* MiniPlayer */}
      <MiniPlayer onOpenFull={() => setFullOpen(true)} />

      {/* FullPlayer */}
      <FullPlayer isOpen={fullOpen} onClose={() => setFullOpen(false)} />
    </div>
  )
}
