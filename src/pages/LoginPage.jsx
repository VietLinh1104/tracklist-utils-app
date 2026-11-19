import { useState } from 'react'
import { Button, FieldError, Input, Label, TextField } from '@heroui/react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng.'
          : err.message
      )
    }
    // AuthContext lắng nghe onAuthStateChange, tự cập nhật session
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-2xl font-semibold text-white">Nhạc</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            fullWidth
          >
            <Label className="text-sm text-gray-400">Email</Label>
            <Input
              placeholder="email@example.com"
              autoComplete="email"
              className="w-full"
            />
          </TextField>

          <TextField
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            isRequired
            fullWidth
          >
            <Label className="text-sm text-gray-400">Mật khẩu</Label>
            <Input
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full"
            />
          </TextField>

          {error && (
            <p className="rounded-lg bg-zinc-900 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            isDisabled={loading}
            fullWidth
            className="mt-2 min-h-[44px]"
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  )
}
