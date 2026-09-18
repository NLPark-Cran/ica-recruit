import { useState } from 'react'
import DashboardTab from '@/features/admin/DashboardTab'
import PrizesTab from '@/features/admin/PrizesTab'
import ActivitiesTab from '@/features/admin/ActivitiesTab'
import DataAssistantTab from '@/features/admin/DataAssistantTab'

const TABS = [
  { key: 'dashboard', label: '📊 仪表盘' },
  { key: 'prizes', label: '🎁 奖池' },
  { key: 'activities', label: '📅 活动' },
  { key: 'assistant', label: '🔍 数据助手' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function Admin() {
  const [tab, setTab] = useState<TabKey>('dashboard')

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-grape">管理后台 🛠️</h1>
        <p className="text-sm text-grape/60">招新数据、奖池配置与内容管理</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-bold whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-grape text-white shadow-sticker'
                : 'bg-white text-grape hover:bg-grape/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'prizes' && <PrizesTab />}
      {tab === 'activities' && <ActivitiesTab />}
      {tab === 'assistant' && <DataAssistantTab />}
    </div>
  )
}
