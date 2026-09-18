import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ApiError } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  /** 触发 429 时通知父组件高亮连接钱包入口 */
  onQuotaExceeded: () => void
}

const SUGGESTIONS = ['杭电有哪些海外交换项目？', '雅思备考两个月够吗？', 'ICA 的英语角怎么参加？']

/** AI 国际交流顾问「小际」：SSE 流式聊天 */
export default function ChatPanel({ onQuotaExceeded }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '你好呀！我是 ICA 的 AI 顾问小际 🌏 海外交换、语言考试、签证、协会活动……有什么想了解的都可以问我～',
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const appendAssistant = (delta: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
      }
      return [...prev, { role: 'assistant', content: delta }]
    })
  }

  const send = async (e?: FormEvent, preset?: string) => {
    e?.preventDefault()
    const text = (preset ?? input).trim()
    if (!text || streaming) return
    setInput('')

    const history = [...messages, { role: 'user' as const, content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    const timer = window.setTimeout(() => controller.abort(), 60_000)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-20) }),
        signal: controller.signal,
      })
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/ai')}`
        return
      }
      if (res.status === 429) {
        onQuotaExceeded()
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: '站点免费额度已用完 😿 你可以连接 Token 钱包，使用自己的额度继续和我聊天～',
          },
        ])
        return
      }
      if (!res.ok || !res.body) {
        throw new ApiError(res.status, `请求失败（${res.status}）`)
      }

      // 解析 SSE：data: {delta} / {error, recovery_action} / [DONE]
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          const line = evt.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const data = JSON.parse(payload) as {
              delta?: string
              error?: string
              recovery_action?: string
            }
            if (data.delta) {
              appendAssistant(data.delta)
            } else if (data.error) {
              appendAssistant(
                `\n\n⚠️ ${data.error}${data.recovery_action ? `\n建议：${data.recovery_action}` : ''}`,
              )
            }
          } catch {
            /* 忽略不完整的事件 */
          }
        }
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      appendAssistant(aborted ? '\n\n⚠️ 响应超时，请换个问题再试试' : '\n\n⚠️ 网络异常，请稍后再试')
    } finally {
      window.clearTimeout(timer)
      setStreaming(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={listRef}
        className="flex max-h-[55dvh] min-h-64 flex-col gap-3 overflow-y-auto rounded-3xl border-2 border-grape/10 bg-white p-4 shadow-card"
      >
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
              m.role === 'user'
                ? 'self-end bg-grape text-white'
                : 'self-start bg-cream text-grape-dark'
            }`}
          >
            {m.content ||
              (streaming && i === messages.length - 1 ? (
                <span className="opacity-50">小际正在输入…</span>
              ) : (
                ''
              ))}
          </motion.div>
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(undefined, s)}
              className="min-h-11 rounded-full border-2 border-grape/15 bg-white px-4 text-xs font-bold text-grape transition-colors hover:border-grape/40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="向小际提问…"
          maxLength={4000}
          disabled={streaming}
          className="min-h-12 flex-1 rounded-full border-2 border-grape/15 bg-white px-5 text-sm outline-none focus:border-grape disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="min-h-12 shrink-0 rounded-full bg-tangerine px-6 text-sm font-black text-white shadow-sticker transition-transform active:scale-95 disabled:opacity-50"
        >
          {streaming ? '…' : '发送'}
        </button>
      </form>
    </div>
  )
}
