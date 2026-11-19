import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PlayerProvider } from './player/PlayerProvider'
import LoginPage from './pages/LoginPage'
import LibraryPage from './pages/LibraryPage'
import MixDetailPage from './pages/MixDetailPage'
import AddMixPage from './pages/AddMixPage'
import AppShell from './components/AppShell'

export default function App() {
  const { session } = useAuth()

  // Đang kiểm tra session (session === undefined)
  if (session === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <span className="text-zinc-600 text-sm">Đang tải…</span>
      </div>
    )
  }

  // Chưa đăng nhập
  if (!session) {
    return <LoginPage />
  }

  // Đã đăng nhập — PlayerProvider ngoài mọi route để <audio> không bị unmount
  return (
    <PlayerProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<LibraryPage />} />
            <Route path="mix/:id" element={<MixDetailPage />} />
            <Route path="add-mix" element={<AddMixPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </PlayerProvider>
  )
}
