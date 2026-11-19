import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Disc3, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import MiniPlayer from './MiniPlayer'
import FullPlayer from './FullPlayer'

export default function AppShell() {
  const { mix } = usePlayer()
  const [fullOpen, setFullOpen] = useState(false)
  const location = useLocation()

  async function handleLogout() {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      await supabase.auth.signOut()
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-black text-white antialiased selection:bg-zinc-800 selection:text-white"
      style={{ minHeight: '100dvh' }}
    >
      {/* Header kính mờ cố định phong cách iOS */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-900/80 bg-black/80 px-4 backdrop-blur-xl transition-all"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: '8px',
          minHeight: '60px',
        }}
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80 active:scale-95"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-850 bg-zinc-950 text-white shadow-sm">
            <Disc3 size={18} className="animate-[spin_12s_linear_infinite]" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">Nhạc</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white active:scale-95"
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

      {/* MiniPlayer dạng Floating Bar */}
      <MiniPlayer onOpenFull={() => setFullOpen(true)} />

      {/* FullPlayer Bottom Sheet */}
      <FullPlayer isOpen={fullOpen} onClose={() => setFullOpen(false)} />
    </div>
  )
}
