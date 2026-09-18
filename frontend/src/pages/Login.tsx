import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useAuth } from '@/hooks/useAuth'

const ERROR_TEXT: Record<string, string> = {
  oauth_denied: '你取消了授权，欢迎随时回来',
  invalid_state: '登录状态已过期，请重试',
  exchange_failed: '登录服务暂时不可用，请稍后再试',
}

/** 仅允许站内相对路径，防止 open redirect */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

export default function Login() {
  const [params] = useSearchParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const error = params.get('error')

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true })
  }, [loading, user, navigate, next])

  const loginUrl = `/api/auth/watcha/login?next=${encodeURIComponent(next)}`
  const errorText = error ? (ERROR_TEXT[error] ?? `登录失败（${error}），请重试`) : null

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card flex w-full max-w-sm flex-col items-center gap-6 p-8 text-center"
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-ink">欢迎回来 👋</h1>
          <p className="text-sm leading-relaxed font-bold text-ink/50">
            使用观猹账号一键登录，参与社团招新任务、抽好礼、领联名 Token 卡。
          </p>
        </div>

        {errorText && (
          <div
            className="w-full rounded-2xl border-[3px] border-ink bg-blush px-4 py-3 text-sm font-black text-ink"
            role="alert"
          >
            ⚠️ {errorText}
          </div>
        )}

        <motion.a
          href={loginUrl}
          whileTap={{ scale: 0.92 }}
          className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-[3px] border-ink bg-sky shadow-sticker transition-transform hover:scale-105"
          aria-label="使用观猹账号登录"
        >
          <span className="text-lg font-black text-ink" aria-hidden>
            观猹
          </span>
          <img
            src="/assets/watcha-logo.webp"
            alt="观猹"
            width={144}
            height={144}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </motion.a>
        <p className="-mt-3 text-sm font-black text-ink">使用观猹账号登录</p>

        <p className="text-xs leading-relaxed font-bold text-ink/40">
          登录即表示同意在招新活动中使用你的昵称参与抽奖与报名
          {next !== '/' && <span className="block">登录后将跳转回 {next}</span>}
        </p>
      </motion.div>
    </div>
  )
}
