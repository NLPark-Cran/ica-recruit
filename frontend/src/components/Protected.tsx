import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'

/** 路由守卫：需登录；社团级页面在页面内部用 me.club_roles 自行校验角色 */
export default function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}

/** 无权限提示页（可爱卡通风） */
export function Forbidden({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="text-6xl">🙈</span>
      <h1 className="text-2xl font-black text-ink">无权限访问</h1>
      <p className="max-w-xs text-sm font-bold text-ink/50">
        {hint ?? '这个页面仅对社团工作人员/管理员开放，请联系社团负责人开通权限。'}
      </p>
    </div>
  )
}
