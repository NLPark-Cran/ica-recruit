import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { AdminStats } from '@/lib/types'

export default function DashboardTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api
      .get<AdminStats>('/api/admin/stats')
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return <p className="py-10 text-center text-sm text-grape/50">统计加载中…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon="👤" label="登录人数" value={stats.users} />
        <StatCard icon="📝" label="报名数" value={stats.applications} />
        {stats.rounds.map((r) => (
          <StatCard
            key={r.round}
            icon="🎰"
            label={`第 ${r.round} 轮抽奖（今日 ${r.today_draws}）`}
            value={r.draws}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.rounds.map((r) => (
          <div
            key={r.round}
            className="rounded-3xl border-2 border-grape/10 bg-white p-6 shadow-card"
          >
            <h3 className="text-base font-black text-grape">第 {r.round} 轮抽奖</h3>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs text-grape/50">中奖</dt>
                <dd className="text-2xl font-black text-grape">{r.wins}</dd>
              </div>
              <div>
                <dt className="text-xs text-grape/50">中奖率</dt>
                <dd className="text-2xl font-black text-tangerine">{r.win_rate}%</dd>
              </div>
              <div>
                <dt className="text-xs text-grape/50">已核销</dt>
                <dd className="text-2xl font-black text-mint">{r.redeemed}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.open('/api/admin/export/applications.csv', '_blank')}
          className="min-h-11 rounded-full bg-grape px-6 text-sm font-bold text-white shadow-sticker transition-transform active:scale-95"
        >
          📥 导出报名 CSV
        </button>
        <button
          type="button"
          onClick={() => window.open('/api/admin/export/draws.csv', '_blank')}
          className="min-h-11 rounded-full border-2 border-grape/25 px-6 text-sm font-bold text-grape transition-colors hover:border-grape"
        >
          📥 导出抽奖 CSV
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="rounded-3xl border-2 border-grape/10 bg-white p-5 shadow-card">
      <span className="text-2xl">{icon}</span>
      <p className="mt-2 text-3xl font-black text-grape">{value}</p>
      <p className="mt-1 text-xs font-bold text-grape/50">{label}</p>
    </div>
  )
}
