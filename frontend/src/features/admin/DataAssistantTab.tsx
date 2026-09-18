import { useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { DataAssistantResult } from '@/lib/types'

export default function DataAssistantTab() {
  const { toast } = useToast()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DataAssistantResult | null>(null)

  const ask = async () => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setResult(null)
    try {
      setResult(
        await api.post<DataAssistantResult>(
          '/api/ai/data-assistant',
          { question: q },
          { timeoutMs: 30_000 },
        ),
      )
    } catch (e) {
      toast(errorMessage(e, '查询失败，请换个问法试试'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const columns = result && result.rows.length > 0 ? Object.keys(result.rows[0]) : []

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void ask()}
          placeholder="用自然语言提问，如：今天有多少人抽奖？"
          maxLength={500}
          className="min-h-12 flex-1 rounded-2xl border-2 border-grape/15 bg-white px-4 text-sm outline-none focus:border-grape"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading || !question.trim()}
          className="min-h-12 shrink-0 rounded-full bg-grape px-6 text-sm font-bold text-white shadow-sticker disabled:opacity-50"
        >
          {loading ? '分析中…' : '🔍 提问'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          {result.summary && (
            <div className="rounded-2xl bg-cream p-4 text-sm leading-relaxed text-grape-dark">
              <span className="font-black">📊 解读：</span>
              {result.summary}
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-bold text-grape/50">生成的 SQL（只读）</p>
            <pre className="overflow-x-auto rounded-2xl bg-grape-dark p-4 text-xs leading-relaxed text-lemon">
              {result.sql}
            </pre>
          </div>
          {result.rows.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-grape/40 shadow-card">
              查询无结果
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-grape/10 bg-white shadow-card">
              <table className="w-full min-w-max text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-grape/10">
                    {columns.map((c) => (
                      <th key={c} className="px-4 py-3 font-black text-grape">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-grape/5 last:border-0">
                      {columns.map((c) => (
                        <td key={c} className="max-w-60 truncate px-4 py-2.5 text-grape-dark/80">
                          {row[c] === null ? '—' : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
