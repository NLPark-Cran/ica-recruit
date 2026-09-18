import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Club } from '@/lib/types'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-full border-[3px] px-4 text-sm font-black whitespace-nowrap transition-all active:translate-x-0.5 active:translate-y-0.5 ${
    isActive
      ? 'border-ink bg-lemon text-ink shadow-sticker-sm'
      : 'border-transparent text-ink/60 hover:text-ink'
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
      <header className="safe-top sticky top-0 z-40 border-b-[3px] border-ink bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-2">
          <NavLink to="/" className="flex min-h-11 shrink-0 items-center gap-2 pr-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-ink bg-lemon text-lg shadow-sticker-sm">
              📣
            </span>
            <span className="text-lg font-black tracking-tight text-ink">社团招新GO</span>
          </NavLink>
          <nav className="flex flex-1 items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              首页
            </NavLink>
            <NavLink to="/ai" className={linkClass}>
              AI
            </NavLink>
            {user && <MyClubs />}
          </nav>
          {user ? (
            <div className="flex shrink-0 items-center gap-2">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.nickname}
                  className="h-9 w-9 rounded-full border-2 border-ink object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-sky text-sm font-black text-ink">
                  {user.nickname.slice(0, 1) || '我'}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-ghost"
              >
                {loggingOut ? '退出中…' : '退出'}
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="btn-lemon shrink-0">
              登录
            </NavLink>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <Outlet />
      </main>
      <footer className="safe-bottom border-t-[3px] border-ink bg-sky/20 py-6 text-center text-xs font-bold text-ink/50">
        社团招新GO · 观猹校园 · 让每个社团都被看见
      </footer>
    </div>
  )
}

/** 「我的社团」下拉：按 me.club_roles 列出，名称取自公开社团列表 */
function MyClubs() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const boxRef = useRef<HTMLDivElement>(null)

  const roles = Object.entries(user?.club_roles ?? {})

  useEffect(() => {
    if (roles.length === 0) return
    api
      .get<{ items: Club[] }>('/api/clubs', { redirectOn401: false })
      .then((data) => {
        const map: Record<string, string> = {}
        for (const c of data.items) map[c.slug] = c.name
        setNames(map)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  if (roles.length === 0) return null

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex min-h-11 items-center gap-1 rounded-full border-[3px] px-4 text-sm font-black whitespace-nowrap transition-all ${
          open
            ? 'border-ink bg-sky text-ink shadow-sticker-sm'
            : 'border-transparent text-ink/60 hover:text-ink'
        }`}
      >
        我的社团 <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="card animate-pop absolute right-0 z-50 mt-2 w-56 p-2 sm:right-auto">
          {roles.map(([slug, role]) => (
            <NavLink
              key={slug}
              to={`/c/${slug}`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-black text-ink transition-colors hover:bg-sky/30"
            >
              <span className="truncate">{names[slug] ?? slug}</span>
              <span className="sticker shrink-0 bg-lemon text-[10px]">
                {role === 'admin' ? '管理员' : '工作人员'}
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
