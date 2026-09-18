import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet } from 'react-router'
import Dropdown from '@/components/Dropdown'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/lib/toast'
import type { Club } from '@/lib/types'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-full border-[3px] px-4 text-sm font-black whitespace-nowrap transition-all active:translate-x-0.5 active:translate-y-0.5 ${
    isActive
      ? 'border-ink bg-lemon text-ink shadow-sticker-sm'
      : 'border-transparent text-ink/60 hover:text-ink'
  }`

export default function Layout() {
  const { user } = useAuth()

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
            <UserMenu />
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

/** 「我的社团」下拉（Portal 渲染，不被顶栏裁剪）：按 me.club_roles 列出 */
function MyClubs() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const btnRef = useRef<HTMLButtonElement>(null)

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

  if (roles.length === 0) return null

  return (
    <>
      <button
        ref={btnRef}
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
      <Dropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)} width={224}>
        {roles.map(([slug, role]) => (
          <NavLink
            key={slug}
            to={`/c/${slug}`}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-black text-ink transition-colors hover:bg-sky/30"
            role="menuitem"
          >
            <span className="truncate">{names[slug] ?? slug}</span>
            <span className="sticker shrink-0 bg-lemon text-[10px]">
              {role === 'admin' ? '管理员' : '工作人员'}
            </span>
          </NavLink>
        ))}
      </Dropdown>
    </>
  )
}

/** 头像下拉菜单：昵称展示、修改昵称、退出登录 */
function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  if (!user) return null

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    await logout()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="账号菜单"
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full transition-transform active:scale-95"
      >
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
        <span aria-hidden className="text-xs font-black text-ink/50">
          {open ? '▴' : '▾'}
        </span>
      </button>

      <Dropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)} width={224}>
        <div className="flex items-center gap-3 rounded-2xl bg-cream px-3 py-2.5">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full border-2 border-ink object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-sky text-sm font-black">
              {user.nickname.slice(0, 1) || '我'}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-ink">{user.nickname}</p>
            {user.is_platform_admin && (
              <span className="sticker bg-blush text-[10px]">平台管理员</span>
            )}
          </div>
        </div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            setEditing(true)
          }}
          className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-black text-ink transition-colors hover:bg-sky/30"
        >
          ✏️ 修改昵称
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-black text-ink transition-colors hover:bg-sky/30 disabled:opacity-50"
        >
          🚪 {loggingOut ? '退出中…' : '退出登录'}
        </button>
      </Dropdown>

      {editing && <NicknameDialog current={user.nickname} onClose={() => setEditing(false)} />}
    </>
  )
}

/** 修改昵称对话框：PATCH /api/auth/me */
function NicknameDialog({ current, onClose }: { current: string; onClose: () => void }) {
  const { refresh } = useAuth()
  const { toast } = useToast()
  const [nickname, setNickname] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const name = nickname.trim()
    if (saving) return
    if (name.length < 1 || name.length > 24) {
      setError('昵称长度需为 1-24 个字符')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.patch('/api/auth/me', { nickname: name })
      await refresh()
      toast('昵称已更新', 'success')
      onClose()
    } catch (err) {
      setError(errorMessage(err, '保存失败，请稍后再试'))
    } finally {
      setSaving(false)
    }
  }

  // Portal 到 body：顶栏 backdrop-blur 会为 fixed 后代创建包含块，必须脱离顶栏渲染
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="card animate-pop w-full max-w-xs space-y-4 p-6"
      >
        <h2 className="text-lg font-black text-ink">修改昵称</h2>
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          autoFocus
          placeholder="1-24 个字符"
        />
        {error && (
          <p className="text-xs font-black text-blush" role="alert">
            ⚠️ {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-lemon flex-1">
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            取消
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
