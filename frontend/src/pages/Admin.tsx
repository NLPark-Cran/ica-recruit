import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Forbidden } from '@/components/Protected'
import Spinner from '@/components/Spinner'
import { api } from '@/lib/api'
import { clubRole } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import type { Club } from '@/lib/types'
import DashboardTab from '@/features/admin/DashboardTab'
import PrizesTab from '@/features/admin/PrizesTab'
import ActivitiesTab from '@/features/admin/ActivitiesTab'
import MembersTab from '@/features/admin/MembersTab'
import SettingsTab from '@/features/admin/SettingsTab'
import DataAssistantTab from '@/features/admin/DataAssistantTab'

const TABS = [
  { key: 'dashboard', label: '📊 仪表盘' },
  { key: 'prizes', label: '🎁 奖池' },
  { key: 'activities', label: '📅 活动' },
  { key: 'members', label: '👥 成员' },
  { key: 'settings', label: '⚙️ 设置' },
  { key: 'assistant', label: '🔍 数据助手' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** 社团管理后台（本社团 admin 可用） */
export default function Admin() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const base = `/api/clubs/${slug}`
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [club, setClub] = useState<Club | null>(null)

  const role = clubRole(user, slug)

  const loadClub = async () => {
    try {
      setClub(await api.get<Club>(`/api/clubs/${slug}`))
    } catch {
      /* 设置页加载失败静默 */
    }
  }

  useEffect(() => {
    void loadClub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (role !== 'admin') {
    return <Forbidden hint="社团后台仅对本社团管理员开放。" />
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="space-y-1">
        <Link to={`/c/${slug}`} className="text-xs font-black text-ink/40 hover:text-ink">
          ← 返回 {club?.name ?? slug}
        </Link>
        <h1 className="text-3xl font-black text-ink">社团后台 🛠️</h1>
        <p className="text-sm font-bold text-ink/50">{club?.name ?? slug} 的招新数据与内容管理</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 shrink-0 rounded-full border-[3px] border-ink px-5 text-sm font-black whitespace-nowrap transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              tab === t.key
                ? 'bg-lemon shadow-sticker'
                : 'bg-white shadow-sticker-sm hover:bg-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab base={base} />}
      {tab === 'prizes' && <PrizesTab base={base} />}
      {tab === 'activities' && <ActivitiesTab base={base} />}
      {tab === 'members' && <MembersTab base={base} />}
      {tab === 'settings' &&
        (club ? <SettingsTab club={club} onSaved={() => void loadClub()} /> : <Spinner />)}
      {tab === 'assistant' && <DataAssistantTab base={base} />}
    </div>
  )
}
