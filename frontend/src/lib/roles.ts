import type { ClubRole, User } from '@/lib/types'

/** 用户在某社团的有效角色：平台管理员视为所有社团的 admin */
export function clubRole(user: User | null, slug: string): ClubRole | null {
  if (!user) return null
  if (user.is_platform_admin) return 'admin'
  return user.club_roles[slug] ?? null
}
