import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import Spinner from '@/components/Spinner'
import { api } from '@/lib/api'
import { clubRole } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import type { Club, LotteryStatus } from '@/lib/types'
import ApplicationForm from '@/features/flow/ApplicationForm'
import DrawCard from '@/features/flow/DrawCard'

/** 社团招新任务流：进群礼抽奖 → 填写报名表 → 报名礼抽奖 */
export default function Flow() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const base = `/api/clubs/${slug}`
  const [club, setClub] = useState<Club | null>(null)
  const [status, setStatus] = useState<LotteryStatus | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api.get<Club>(`/api/clubs/${slug}`),
        api.get<LotteryStatus>(`${base}/lottery/status`),
      ])
      setClub(c)
      setStatus(s)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [base, slug])

  useEffect(() => {
    void load()
  }, [load])

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="text-5xl">📡</span>
        <p className="text-sm font-bold text-ink/50">加载失败，请检查网络</p>
        <button type="button" onClick={() => void load()} className="btn-lemon">
          重新加载
        </button>
      </div>
    )
  }
  if (!status || !club) return <Spinner />

  const cardUrl = status.card_url || club.card_url
  const role = clubRole(user, slug)
  const round1 = status.rounds.find((r) => r.round === 1)
  const round2 = status.rounds.find((r) => r.round === 2)
  const steps = [
    { label: '进群礼抽奖', done: !!round1?.drawn },
    { label: '填写报名表', done: status.applied },
    { label: '报名礼抽奖', done: !!round2?.drawn },
  ]

  return (
    <div className="mx-auto max-w-xl space-y-8 py-6">
      <div className="space-y-1">
        <Link to={`/c/${slug}`} className="text-xs font-black text-ink/40 hover:text-ink">
          ← 返回 {club.name}
        </Link>
        <h1 className="text-3xl font-black text-ink">招新任务 🎯</h1>
        <p className="text-sm font-bold text-ink/50">完成三步任务，好礼与联名 Token 卡等你拿！</p>
      </div>

      {/* 步骤条 */}
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-ink text-sm font-black transition-colors ${
                  s.done ? 'bg-leaf text-white shadow-sticker-sm' : 'bg-white text-ink/40'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs font-black whitespace-nowrap ${s.done ? 'text-ink' : 'text-ink/40'}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mb-6 h-1 flex-1 rounded-full ${s.done ? 'bg-leaf' : 'bg-ink/15'}`} />
            )}
          </li>
        ))}
      </ol>

      {/* 工作人员快捷入口条 */}
      {role && (
        <div className="flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-white p-2 shadow-sticker">
          <span className="sticker shrink-0 bg-blush text-[10px]">工作通道</span>
          <Link
            to={`/c/${slug}/redeem`}
            className="btn-lemon min-h-9 flex-1 border-2 px-3 py-1 text-xs shadow-sticker-sm"
          >
            🎫 核销台
          </Link>
          {role === 'admin' && (
            <Link
              to={`/c/${slug}/admin`}
              className="btn-sky min-h-9 flex-1 border-2 px-3 py-1 text-xs shadow-sticker-sm"
            >
              🛠️ 后台
            </Link>
          )}
        </div>
      )}

      {/* 第一步：进群礼 */}
      <section className="space-y-3">
        <StepTitle
          index={1}
          title={round1?.title || '进群礼抽奖'}
          subtitle="扫码进群后即可抽奖，好礼先到先得"
        />
        {round1 && <DrawCard base={base} round={round1} onDrawn={() => void load()} />}
      </section>

      {/* 第二步：报名表 */}
      <section className="space-y-3">
        <StepTitle index={2} title="填写报名表" subtitle="填写后解锁报名礼抽奖 + 联名 Token 卡" />
        {status.applied ? (
          <div className="card flex items-center gap-4 p-6">
            <span className="text-4xl">✅</span>
            <div className="flex-1">
              <p className="font-black text-ink">已提交报名表</p>
              <p className="text-xs font-bold text-ink/50">
                后续通知将通过微信发送，请留意好友申请
              </p>
            </div>
            {cardUrl && (
              <button
                type="button"
                onClick={() => window.open(cardUrl, '_blank', 'noopener')}
                className="btn-sky shrink-0 px-4 text-xs"
              >
                🪙 领 Token 卡
              </button>
            )}
          </div>
        ) : (
          <ApplicationForm
            base={base}
            departments={club.departments}
            cardUrl={cardUrl}
            onSuccess={() => void load()}
          />
        )}
      </section>

      {/* 第三步：报名礼 */}
      <section className="space-y-3">
        <StepTitle
          index={3}
          title={round2?.title || '报名礼抽奖'}
          subtitle="提交报名表后解锁，中奖率更高"
        />
        {round2 && <DrawCard base={base} round={round2} onDrawn={() => void load()} />}
      </section>
    </div>
  )
}

function StepTitle({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="sticker bg-lemon">STEP {index}</span>
      <div>
        <h2 className="text-lg font-black text-ink">{title}</h2>
        <p className="text-xs font-bold text-ink/40">{subtitle}</p>
      </div>
    </div>
  )
}
