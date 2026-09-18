import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { AdminStats } from '@/lib/types'

export default function DashboardTab({ base }: { base: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api
      .get<AdminStats>(`${base}/admin/stats`)
      .then(setStats)
      .catch(() => {})
  }, [base])

  if (!stats) return <p className="py-10 text-center text-sm font-bold text-ink/50">统计加载中…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon="👤" label="登录人数" value={stats.visitors} />
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
          <div key={r.round} className="card p-6">
            <h3 className="text-base font-black text-ink">第 {r.round} 轮抽奖</h3>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs font-bold text-ink/50">中奖</dt>
                <dd className="text-2xl font-black text-ink">{r.wins}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-ink/50">中奖率</dt>
                <dd className="text-2xl font-black text-leaf">{r.win_rate}%</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-ink/50">已核销</dt>
                <dd className="text-2xl font-black text-sky-dark">{r.redeemed}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.open(`${base}/admin/export/applications.csv`, '_blank')}
          className="btn-lemon"
        >
          📥 导出报名 CSV
        </button>
        <button
          type="button"
          onClick={() => window.open(`${base}/admin/export/draws.csv`, '_blank')}
          className="btn-sky"
        >
          📥 导出抽奖 CSV
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="card p-5">
      <span className="text-2xl">{icon}</span>
      <p className="mt-2 text-3xl font-black text-ink">{value}</p>
      <p className="mt-1 text-xs font-bold text-ink/50">{label}</p>
    </div>
  )
}
