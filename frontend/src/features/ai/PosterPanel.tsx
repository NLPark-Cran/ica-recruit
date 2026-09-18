import { useState } from 'react'
import { motion } from 'motion/react'
import { api, ApiError, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'

interface Props {
  onQuotaExceeded: () => void
}

/** AI 招新海报生成 */
export default function PosterPanel({ onQuotaExceeded }: Props) {
  const { toast } = useToast()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imgError, setImgError] = useState(false)

  const generate = async () => {
    const p = prompt.trim()
    if (!p || loading) return
    setLoading(true)
    setImageUrl('')
    setImgError(false)
    try {
      const data = await api.post<{ url: string }>(
        '/api/ai/poster',
        { prompt: p },
        { timeoutMs: 60_000 },
      )
      setImageUrl(data.url)
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        onQuotaExceeded()
        toast('站点免费额度已用完，可连接 Token 钱包使用自己的额度', 'error')
      } else {
        toast(errorMessage(e, '海报生成失败，请稍后再试'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void generate()}
          placeholder="一句话描述海报主题，如：百团大战 ICA 招新，青春国际化"
          maxLength={500}
          className="min-h-12 flex-1 rounded-2xl border-2 border-grape/15 bg-white px-4 text-sm outline-none focus:border-grape"
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !prompt.trim()}
          className="min-h-12 shrink-0 rounded-full bg-gradient-to-r from-grape to-grape-light px-6 text-sm font-black text-white shadow-sticker transition-transform active:scale-95 disabled:opacity-50"
        >
          {loading ? '生成中…' : '✨ 生成海报'}
        </button>
      </div>

      {loading && (
        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-grape/20 bg-white text-sm text-grape/50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape/20 border-t-grape" />
          AI 正在绘制海报，可能需要十几秒…
        </div>
      )}

      {imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-3"
        >
          <div className="img-fallback aspect-[3/4] w-full overflow-hidden rounded-3xl shadow-card">
            {!imgError ? (
              <img
                src={imageUrl}
                alt="AI 生成的招新海报"
                width={768}
                height={1024}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
                图片加载失败，可复制链接在浏览器打开
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-grape text-sm font-bold text-white shadow-sticker"
            >
              🔗 新窗口查看原图
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(imageUrl).then(
                  () => toast('图片链接已复制', 'success'),
                  () => toast('复制失败，请手动复制', 'error'),
                )
              }}
              className="min-h-11 rounded-full border-2 border-grape/20 px-5 text-sm font-bold text-grape"
            >
              复制链接
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
