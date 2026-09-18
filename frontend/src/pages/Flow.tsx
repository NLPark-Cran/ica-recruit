import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import Spinner from '@/components/Spinner'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { LotteryStatus } from '@/lib/types'
import ApplicationForm from '@/features/flow/ApplicationForm'
import DrawCard from '@/features/flow/DrawCard'

const BYOK_TOAST: Record<string, { text: string; type: 'success' | 'error' }> = {
  ok: { text: 'Token 钱包连接成功，AI 功能将使用你的额度', type: 'success' },
  error: { text: 'Token 钱包连接失败，请稍后重试', type: 'error' },
  expired: { text: '连接已过期，请重新发起连接', type: 'error' },
}

export default function Flow() {
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<LotteryStatus | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await api.get<LotteryStatus>('/api/lottery/status'))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // BYOK 回跳参数提示
  useEffect(() => {
    const byok = params.get('byok')
    if (byok) {
      const t = BYOK_TOAST[byok]
      if (t) toast(t.text, t.type)
      params.delete('byok')
      setParams(params, { replace: true })
    }
  }, [params, setParams, toast])

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="text-5xl">📡</span>
        <p className="text-sm text-grape/60">加载失败，请检查网络</p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-11 rounded-full bg-grape px-6 text-sm font-bold text-white shadow-sticker"
        >
          重新加载
        </button>
      </div>
    )
  }
  if (!status) return <Spinner />

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
        <h1 className="text-3xl font-black text-grape">招新任务 🎯</h1>
        <p className="text-sm text-grape/60">完成三步任务，好礼与联名 Token 卡等你拿！</p>
      </div>

      {/* 步骤条 */}
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black transition-colors ${
                  s.done
                    ? 'border-mint bg-mint text-white'
                    : 'border-grape/25 bg-white text-grape/50'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs font-bold whitespace-nowrap ${s.done ? 'text-grape' : 'text-grape/40'}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mb-6 h-0.5 flex-1 rounded ${s.done ? 'bg-mint' : 'bg-grape/15'}`} />
            )}
          </li>
        ))}
      </ol>

      {/* 第一步：进群礼 */}
      <section className="space-y-3">
        <StepTitle
          index={1}
          title={round1?.title || '进群礼抽奖'}
          subtitle="扫码进群后即可抽奖，好礼先到先得"
        />
        {round1 && <DrawCard round={round1} onDrawn={() => void load()} />}
      </section>

      {/* 第二步：报名表 */}
      <section className="space-y-3">
        <StepTitle index={2} title="填写报名表" subtitle="填写后解锁报名礼抽奖 + 联名 Token 卡" />
        {status.applied ? (
          <div className="flex items-center gap-4 rounded-3xl border-2 border-mint/40 bg-white p-6 shadow-card">
            <span className="text-4xl">✅</span>
            <div className="flex-1">
              <p className="font-black text-grape">已提交报名表</p>
              <p className="text-xs text-grape/50">面试通知将通过微信发送，请留意好友申请</p>
            </div>
            <button
              type="button"
              onClick={() => window.open(status.card_url, '_blank', 'noopener')}
              className="min-h-11 shrink-0 rounded-full bg-grape px-4 text-xs font-bold text-white shadow-sticker"
            >
              🪙 领 Token 卡
            </button>
          </div>
        ) : (
          <ApplicationForm cardUrl={status.card_url} onSuccess={() => void load()} />
        )}
      </section>

      {/* 第三步：报名礼 */}
      <section className="space-y-3">
        <StepTitle
          index={3}
          title={round2?.title || '报名礼抽奖'}
          subtitle="提交报名表后解锁，中奖率更高"
        />
        {round2 && <DrawCard round={round2} onDrawn={() => void load()} />}
      </section>
    </div>
  )
}

function StepTitle({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full bg-tangerine px-3 py-1 text-xs font-black text-white shadow-sticker">
        STEP {index}
      </span>
      <div>
        <h2 className="text-lg font-black text-grape">{title}</h2>
        <p className="text-xs text-grape/50">{subtitle}</p>
      </div>
    </div>
  )
}
