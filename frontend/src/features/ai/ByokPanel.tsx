import { useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/lib/toast'

interface Props {
  /** 429 等额度场景下高亮连接按钮 */
  highlight?: boolean
}

/** Token 钱包（BYOK）连接状态与操作 */
export default function ByokPanel({ highlight = false }: Props) {
  const { user, refresh } = useAuth()
  const { toast } = useToast()
  const [disconnecting, setDisconnecting] = useState(false)

  if (!user) return null

  const disconnect = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await api.del('/api/byok')
      await refresh()
      toast('已断开 Token 钱包', 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  if (user.has_tokendance_key) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-mint/40 bg-white p-4 shadow-card">
        <span className="text-2xl">🪙</span>
        <div className="flex-1">
          <p className="text-sm font-black text-grape">Token 钱包已连接</p>
          <p className="text-xs text-grape/50">AI 功能正在使用你自己的额度，不限站点配额</p>
        </div>
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={disconnecting}
          className="min-h-11 shrink-0 rounded-full border-2 border-grape/20 px-4 text-sm font-bold text-grape disabled:opacity-50"
        >
          {disconnecting ? '断开中…' : '断开'}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-4 shadow-card ${
        highlight ? 'animate-pulse border-tangerine' : 'border-grape/10'
      }`}
    >
      <span className="text-2xl">🪙</span>
      <div className="flex-1">
        <p className="text-sm font-black text-grape">连接 Token 钱包</p>
        <p className="text-xs text-grape/50">连接后使用自己的 AI 额度，不受站点每日配额限制</p>
      </div>
      <a
        href="/api/byok/connect"
        className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold text-white shadow-sticker transition-transform active:scale-95 ${
          highlight ? 'bg-tangerine' : 'bg-grape'
        }`}
      >
        去连接 →
      </a>
    </div>
  )
}
