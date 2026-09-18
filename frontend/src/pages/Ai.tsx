import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import ByokPanel from '@/features/ai/ByokPanel'
import ChatPanel from '@/features/ai/ChatPanel'
import PosterPanel from '@/features/ai/PosterPanel'
import { useToast } from '@/lib/toast'

type TabKey = 'chat' | 'poster'

const BYOK_TOAST: Record<string, { text: string; type: 'success' | 'error' }> = {
  ok: { text: 'Token 钱包连接成功，AI 功能将使用你的额度', type: 'success' },
  error: { text: 'Token 钱包连接失败，请稍后重试', type: 'error' },
  expired: { text: '连接已过期，请重新发起连接', type: 'error' },
}

export default function Ai() {
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>('chat')
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  // BYOK 回跳参数提示（/ai?byok=ok|error|expired）
  useEffect(() => {
    const byok = params.get('byok')
    if (byok) {
      const t = BYOK_TOAST[byok]
      if (t) toast(t.text, t.type)
      params.delete('byok')
      setParams(params, { replace: true })
    }
  }, [params, setParams, toast])

  return (
    <div className="mx-auto max-w-xl space-y-5 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-ink">AI 赋能 ✨</h1>
        <p className="text-sm font-bold text-ink/50">
          AI 交流顾问 + AI 招新海报，由 Token 钱包提供算力
        </p>
      </div>

      {quotaExceeded && (
        <div
          className="rounded-2xl border-[3px] border-ink bg-blush px-4 py-3 text-sm font-black text-ink"
          role="alert"
        >
          ⚠️ 站点免费额度已用完，可连接 Token 钱包继续使用自己的额度
        </div>
      )}
      <ByokPanel highlight={quotaExceeded} />

      <div className="flex gap-2" role="tablist">
        {(
          [
            { key: 'chat', label: '🌏 交流顾问' },
            { key: 'poster', label: '🎨 招新海报' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 flex-1 rounded-full border-[3px] border-ink text-sm font-black transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              tab === t.key
                ? 'bg-lemon shadow-sticker'
                : 'bg-white shadow-sticker-sm hover:bg-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' ? (
        <ChatPanel onQuotaExceeded={() => setQuotaExceeded(true)} />
      ) : (
        <PosterPanel onQuotaExceeded={() => setQuotaExceeded(true)} />
      )}
    </div>
  )
}
