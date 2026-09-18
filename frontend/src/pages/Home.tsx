import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Activity } from '@/lib/types'

const DEFAULT_ACTIVITIES: Pick<Activity, 'id' | 'title' | 'summary' | 'cover_url' | 'location'>[] =
  [
    {
      id: 'default-1',
      title: '英语角 English Corner',
      summary: '每周主题畅聊，和留学生一起练口语，从打招呼聊到世界观。',
      cover_url: '/assets/act-1.webp',
      location: '下沙校区 · 每周三晚',
    },
    {
      id: 'default-2',
      title: '模拟联合国 MUN',
      summary: '西装革履化身各国外交官，在交锋与协商中理解世界运转的逻辑。',
      cover_url: '/assets/act-2.webp',
      location: '校内会议厅 · 学期制',
    },
    {
      id: 'default-3',
      title: '海外交换分享会',
      summary: '刚从海外回来的学长姐，手把手分享交换申请、选课与海外生活。',
      cover_url: '/assets/act-3.webp',
      location: '线上 + 线下 · 每月一期',
    },
  ]

const DEPARTMENTS = [
  { name: '组织部', icon: '🎯', desc: '活动策划与执行，让每个点子落地生根。' },
  { name: '宣传部', icon: '🎨', desc: '海报、推送、影像，用创意讲好 ICA 的故事。' },
  { name: '外联部', icon: '🤝', desc: '对接校内外组织与企业，为协会链接资源。' },
  { name: '学术部', icon: '📚', desc: '语言学习与留学干货，做最靠谱的知识后盾。' },
  { name: '办公室', icon: '🗂️', desc: '统筹、财务、档案，协会运转的中枢神经。' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
} as const

function ActivityImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="img-fallback aspect-[4/3] w-full overflow-hidden">
      {!failed && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          width={400}
          height={300}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES)

  useEffect(() => {
    api
      .get<{ items: Activity[] }>('/api/activities', { redirectOn401: false })
      .then((data) => {
        if (data.items.length > 0) setActivities(data.items)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-16 pt-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] shadow-card">
        <div className="img-fallback relative aspect-[4/5] w-full sm:aspect-[16/8]">
          <img
            src="/assets/hero.webp"
            alt="ICA 招新主视觉"
            fetchPriority="high"
            decoding="async"
            width={1280}
            height={640}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-grape-dark/85 via-grape/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-4 p-6 sm:p-10">
            <span className="animate-pop rounded-full bg-lemon px-4 py-1.5 text-xs font-black text-grape-dark shadow-sticker">
              2026 百团大战 · 火热招新中
            </span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-black tracking-tight text-white sm:text-6xl"
            >
              你好，新朋友 👋
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="max-w-md text-base font-medium text-white/90 sm:text-lg"
            >
              这里是杭电国际交流协会 ICA——英语角、模拟联合国、海外交换分享会……
              和一群有趣的人，一起去看更大的世界。
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Link
                to={user ? '/flow' : '/login'}
                className="inline-flex min-h-12 items-center rounded-full bg-tangerine px-8 text-lg font-black text-white shadow-sticker transition-transform hover:scale-105 active:scale-95"
              >
                立即参与招新 →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 协会介绍 */}
      <motion.section {...fadeUp} className="space-y-4">
        <h2 className="text-3xl font-black text-grape">
          关于 ICA <span className="text-tangerine">·</span>{' '}
          <span className="text-lg font-bold text-grape/50">About Us</span>
        </h2>
        <div className="rounded-3xl border-2 border-grape/10 bg-white p-6 shadow-card sm:p-8">
          <p className="leading-relaxed text-grape-dark/80">
            杭州电子科技大学国际交流协会（International Communication
            Association），是校园里最国际化的学生社团。我们相信语言是桥、世界是书——在这里你可以练口语、
            打模联、听海外交换的第一手经验，还能认识来自世界各地的留学生朋友。无论你想提升英语、
            规划留学，还是单纯想看看更大的世界，ICA 都欢迎你的加入。
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ['5', '部门分工'],
              ['10+', '品牌活动 / 学期'],
              ['1000+', '校友伙伴'],
            ].map(([num, label]) => (
              <div key={label} className="rounded-2xl bg-cream px-2 py-4">
                <div className="text-2xl font-black text-grape sm:text-3xl">{num}</div>
                <div className="mt-1 text-xs font-bold text-grape/60">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 品牌活动 */}
      <motion.section {...fadeUp} className="space-y-4">
        <h2 className="text-3xl font-black text-grape">
          品牌活动 <span className="text-tangerine">·</span>{' '}
          <span className="text-lg font-bold text-grape/50">Signature Events</span>
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((a, i) => (
            <div
              key={a.id}
              className="overflow-hidden rounded-3xl border-2 border-grape/10 bg-white shadow-card transition-transform hover:-translate-y-1"
            >
              <ActivityImage src={a.cover_url || `/assets/act-${(i % 3) + 1}.webp`} alt={a.title} />
              <div className="space-y-2 p-5">
                <h3 className="text-lg font-black text-grape">{a.title}</h3>
                <p className="line-clamp-2 text-sm leading-relaxed text-grape/60">{a.summary}</p>
                {a.location && (
                  <span className="inline-block rounded-full bg-cream px-3 py-1 text-xs font-bold text-grape/70">
                    📍 {a.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 部门介绍 */}
      <motion.section {...fadeUp} className="space-y-4">
        <h2 className="text-3xl font-black text-grape">
          部门介绍 <span className="text-tangerine">·</span>{' '}
          <span className="text-lg font-bold text-grape/50">Departments</span>
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {DEPARTMENTS.map((d) => (
            <div
              key={d.name}
              className="flex flex-col items-center gap-2 rounded-3xl border-2 border-grape/10 bg-white p-5 text-center shadow-card transition-transform hover:-translate-y-1"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream text-3xl">
                {d.icon}
              </span>
              <h3 className="text-base font-black text-grape">{d.name}</h3>
              <p className="text-xs leading-relaxed text-grape/60">{d.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 底部引导 */}
      <motion.section {...fadeUp}>
        <div className="flex flex-col items-center gap-5 rounded-[2rem] bg-gradient-to-br from-grape to-grape-light p-8 text-center text-white shadow-card sm:p-12">
          <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-black">
            🎁 进群有礼 · 报名再抽
          </span>
          <h2 className="text-3xl font-black sm:text-4xl">扫码进群 → 登录抽奖</h2>
          <p className="max-w-md text-sm leading-relaxed text-white/80">
            现场扫码进入招新群，用观猹账号登录即可参与「进群礼」抽奖；提交报名表后还有「报名礼」，
            更有机会领取观猹×杭电 ICA 联名 Token 虚拟卡！
          </p>
          <Link
            to={user ? '/flow' : '/login'}
            className="inline-flex min-h-12 items-center rounded-full bg-tangerine px-8 text-lg font-black text-white shadow-sticker transition-transform hover:scale-105 active:scale-95"
          >
            {user ? '进入招新任务 →' : '登录参与抽奖 →'}
          </Link>
        </div>
      </motion.section>
    </div>
  )
}
