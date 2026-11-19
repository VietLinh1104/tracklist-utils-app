import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../player/PlayerProvider'
import MiniPlayer from './MiniPlayer'
import FullPlayer from './FullPlayer'

export default function AppShell() {
  const { mix } = usePlayer()
  const [fullOpen, setFullOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div
      className="flex flex-col bg-black text-white"
      style={{ minHeight: '100dvh' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between border-b border-zinc-900 px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: '56px' }}
      >
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Nhạc
        </Link>
        <button
          onClick={handleLogout}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 transition-colors hover:text-white"
          aria-label="Đăng xuất"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Nội dung trang — thêm padding đáy khi MiniPlayer hiện */}
      <main
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ paddingBottom: mix ? '80px' : undefined }}
      >
        <Outlet />
      </main>

      {/* MiniPlayer */}
      <MiniPlayer onOpenFull={() => setFullOpen(true)} />

      {/* FullPlayer modal */}
      <FullPlayer isOpen={fullOpen} onClose={() => setFullOpen(false)} />
    </div>
  )
}
