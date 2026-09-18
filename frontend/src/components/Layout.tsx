import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors ${
    isActive ? 'bg-grape text-white' : 'text-grape hover:bg-grape/10'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    await logout()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b-2 border-grape/10 bg-cream/90 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-2">
          <NavLink to="/" className="flex min-h-11 shrink-0 items-center gap-2 pr-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-grape to-grape-light text-lg shadow-sticker">
              🌍
            </span>
            <span className="text-lg font-black tracking-tight text-grape">ICA</span>
          </NavLink>
          <nav className="flex flex-1 items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              首页
            </NavLink>
            <NavLink to="/flow" className={linkClass}>
              任务
            </NavLink>
            <NavLink to="/ai" className={linkClass}>
              AI
            </NavLink>
            {user && (user.role === 'staff' || user.role === 'admin') && (
              <NavLink to="/redeem" className={linkClass}>
                核销
              </NavLink>
            )}
            {user && user.role === 'admin' && (
              <NavLink to="/admin" className={linkClass}>
                管理
              </NavLink>
            )}
          </nav>
          {user ? (
            <div className="flex shrink-0 items-center gap-2">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.nickname}
                  className="h-9 w-9 rounded-full border-2 border-grape/20 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-grape-light text-sm font-bold text-white">
                  {user.nickname.slice(0, 1) || '我'}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="min-h-11 rounded-full border-2 border-grape/20 px-4 text-sm font-bold text-grape transition-colors hover:border-tangerine hover:text-tangerine disabled:opacity-50"
              >
                {loggingOut ? '退出中…' : '退出'}
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="flex min-h-11 shrink-0 items-center rounded-full bg-tangerine px-5 text-sm font-bold text-white shadow-sticker transition-transform active:scale-95"
            >
              登录
            </NavLink>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <Outlet />
      </main>
      <footer className="border-t-2 border-grape/10 py-6 text-center text-xs text-grape/50 safe-bottom">
        杭州电子科技大学国际交流协会 ICA · 2026 百团大战
      </footer>
    </div>
  )
}
