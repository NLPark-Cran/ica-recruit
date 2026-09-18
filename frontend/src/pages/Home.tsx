import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Club } from '@/lib/types'

const FEATURES = [
  { icon: '🎡', title: '抽奖', desc: '进群礼 + 报名礼，两轮抽奖引爆人气' },
  { icon: '📝', title: '报名', desc: '意向部门、一键导出，报名表秒收集' },
  { icon: '🎫', title: '核销', desc: '现场扫码发奖，多设备安全不重复' },
  { icon: '✨', title: 'AI', desc: 'AI 顾问答疑、海报生成、数据助手' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
} as const

export default function Home() {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<Club[] | null>(null)

  useEffect(() => {
    api
      .get<{ items: Club[] }>('/api/clubs', { redirectOn401: false })
      .then((data) => setClubs(data.items))
      .catch(() => setClubs([]))
  }, [])

  return (
    <div className="space-y-16 pt-6">
      {/* Hero */}
      <section className="card relative overflow-hidden">
        <div className="img-fallback relative aspect-[4/5] w-full sm:aspect-[16/8]">
          <img
            src="/assets/hero.webp"
            alt="开学季社团招新主视觉"
            fetchPriority="high"
            decoding="async"
            width={1280}
            height={640}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-4 p-6 sm:p-10">
            <span className="sticker animate-pop bg-lemon">🎒 开学季 · 百团大战进行中</span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-black tracking-tight text-white drop-shadow-[2px_2px_0_rgba(29,29,29,0.9)] sm:text-6xl"
            >
              社团招新，一站搞定！
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="max-w-md text-base font-bold text-white/95 sm:text-lg"
            >
              社团招新一站式平台：抽奖、报名、核销、AI，全部开箱即用。 ICA
              国际交流协会等社团已率先入驻，快来看看吧！
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3"
            >
              <a href="#clubs" className="btn-lemon min-h-12 text-base">
                逛逛入驻社团 👇
              </a>
              <Link
                to={user ? '/new-club' : '/login?next=/new-club'}
                className="btn-sky min-h-12 text-base"
              >
                我要入驻 →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 平台能力 */}
      <motion.section {...fadeUp} className="space-y-4">
        <h2 className="text-3xl font-black text-ink">
          平台能力 <span className="text-sky-dark">·</span>{' '}
          <span className="text-lg font-bold text-ink/40">What We Offer</span>
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card flex flex-col items-center gap-2 p-5 text-center transition-transform hover:-translate-y-1"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink bg-sky text-3xl shadow-sticker-sm">
                {f.icon}
              </span>
              <h3 className="text-lg font-black text-ink">{f.title}</h3>
              <p className="text-xs leading-relaxed font-bold text-ink/50">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 入驻社团 */}
      <motion.section {...fadeUp} id="clubs" className="space-y-4 scroll-mt-20">
        <h2 className="text-3xl font-black text-ink">
          入驻社团 <span className="text-sky-dark">·</span>{' '}
          <span className="text-lg font-bold text-ink/40">Clubs On Board</span>
        </h2>
        {clubs === null ? (
          <p className="card p-8 text-center text-sm font-bold text-ink/40">社团加载中…</p>
        ) : clubs.length === 0 ? (
          <p className="card p-8 text-center text-sm font-bold text-ink/40">
            还没有社团入驻，成为第一个吧！🎈
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c) => (
              <Link
                key={c.id}
                to={`/c/${c.slug}`}
                className="card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5 active:shadow-sticker-sm"
              >
                <div className="flex items-center gap-3">
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={c.name}
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      className="h-14 w-14 shrink-0 rounded-2xl border-[3px] border-ink object-cover shadow-sticker-sm"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink bg-lemon text-2xl shadow-sticker-sm">
                      🏫
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-ink group-hover:underline">
                      {c.name}
                    </h3>
                    {c.my_role && (
                      <span className="sticker mt-1 bg-sky text-[10px]">
                        {c.my_role === 'admin' ? '我是管理员' : '我是工作人员'}
                      </span>
                    )}
                  </div>
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed font-bold text-ink/50">
                  {c.intro || '这个社团还没有写简介～'}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs font-bold text-ink/40">
                    {c.departments.length > 0
                      ? `${c.departments.length} 个部门招新中`
                      : '招新进行中'}
                  </span>
                  <span className="sticker bg-lemon">去看看 →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </motion.section>

      {/* 入驻 CTA */}
      <motion.section {...fadeUp}>
        <div className="card flex flex-col items-center gap-5 bg-sky/30 p-8 text-center sm:p-12">
          <span className="sticker bg-white">🚀 0 成本入驻 · 5 分钟上线</span>
          <h2 className="text-3xl font-black text-ink sm:text-4xl">你的社团也值得拥有</h2>
          <p className="max-w-md text-sm leading-relaxed font-bold text-ink/60">
            创建社团主页、配置抽奖奖池、收集报名表、现场核销发奖，还有 AI
            助手帮你写活动文案、查招新数据——全部免费开箱即用。
          </p>
          <Link
            to={user ? '/new-club' : '/login?next=/new-club'}
            className="btn-lemon min-h-12 text-lg"
          >
            我要入驻 →
          </Link>
        </div>
      </motion.section>
    </div>
  )
}
