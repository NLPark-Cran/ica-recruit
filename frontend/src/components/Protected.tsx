import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'

/** 路由守卫：需登录；roles 指定时校验角色，不满足显示无权限页 */
export default function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="text-6xl">🚧</span>
        <h1 className="text-2xl font-black text-grape">无权限访问</h1>
        <p className="max-w-xs text-sm text-grape/60">
          这个页面仅对{roles.includes('admin') ? '管理员' : '工作人员'}
          开放。如果你认为自己应该有权限，请联系协会负责人。
        </p>
      </div>
    )
  }
  return <>{children}</>
}
