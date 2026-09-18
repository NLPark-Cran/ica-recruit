import { useState } from 'react'
import ByokPanel from '@/features/ai/ByokPanel'
import ChatPanel from '@/features/ai/ChatPanel'
import PosterPanel from '@/features/ai/PosterPanel'

type TabKey = 'chat' | 'poster'

export default function Ai() {
  const [tab, setTab] = useState<TabKey>('chat')
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  return (
    <div className="mx-auto max-w-xl space-y-5 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-grape">AI 赋能 ✨</h1>
        <p className="text-sm text-grape/60">
          AI 国际交流顾问 + AI 招新海报，由 Token 钱包提供算力
        </p>
      </div>

      {quotaExceeded && (
        <div
          className="rounded-2xl bg-tangerine/10 px-4 py-3 text-sm font-bold text-tangerine"
          role="alert"
        >
          ⚠️ 站点免费额度已用完，可连接 Token 钱包继续使用自己的额度
        </div>
      )}
      <ByokPanel highlight={quotaExceeded} />

      <div className="flex gap-2" role="tablist">
        {(
          [
            { key: 'chat', label: '🌏 顾问小际' },
            { key: 'poster', label: '🎨 招新海报' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 flex-1 rounded-full text-sm font-bold transition-colors ${
              tab === t.key
                ? 'bg-grape text-white shadow-sticker'
                : 'bg-white text-grape hover:bg-grape/10'
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
