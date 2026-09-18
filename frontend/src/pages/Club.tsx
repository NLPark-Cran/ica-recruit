import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'motion/react'
import Spinner from '@/components/Spinner'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Activity, Club } from '@/lib/types'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
} as const

/** 社团门户：介绍 + 部门 + 活动 + 招新任务入口 + 工作人员快捷入口 */
export default function Club() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [club, setClub] = useState<Club | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activities, setActivities] = useState<Activity[] | null>(null)

  useEffect(() => {
    setClub(null)
    setNotFound(false)
    setActivities(null)
    api
      .get<Club>(`/api/clubs/${slug}`, { redirectOn401: false })
      .then(setClub)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true)
      })
    api
      .get<{ items: Activity[] }>(`/api/clubs/${slug}/activities`, { redirectOn401: false })
      .then((d) => setActivities(d.items))
      .catch(() => setActivities([]))
  }, [slug])

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="text-6xl">🔍</span>
        <h1 className="text-2xl font-black text-ink">没有找到这个社团</h1>
        <p className="text-sm font-bold text-ink/50">链接可能有误，或者社团还未入驻</p>
        <Link to="/" className="btn-lemon">
          回到首页
        </Link>
      </div>
    )
  }
  if (!club) return <Spinner />

  const isStaff = club.my_role === 'staff' || club.my_role === 'admin'

  return (
    <div className="space-y-10 py-6">
      {/* 社团头部 */}
      <section className="card flex flex-col items-center gap-4 bg-sky/20 p-8 text-center sm:p-10">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            width={96}
            height={96}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            className="h-24 w-24 rounded-3xl border-[3px] border-ink object-cover shadow-sticker"
          />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-3xl border-[3px] border-ink bg-lemon text-5xl shadow-sticker">
            🏫
          </span>
        )}
        <h1 className="text-3xl font-black text-ink sm:text-4xl">{club.name}</h1>
        {club.intro && (
          <p className="max-w-lg text-sm leading-relaxed font-bold text-ink/60">{club.intro}</p>
        )}
        {club.contact && <span className="sticker bg-white">📮 联系：{club.contact}</span>}
        <Link
          to={user ? `/c/${slug}/flow` : `/login?next=${encodeURIComponent(`/c/${slug}/flow`)}`}
          className="btn-lemon min-h-12 text-lg"
        >
          🎯 参与招新任务
        </Link>
      </section>

      {/* 意向部门 */}
      {club.departments.length > 0 && (
        <motion.section {...fadeUp} className="space-y-3">
          <h2 className="text-2xl font-black text-ink">意向部门</h2>
          <div className="flex flex-wrap gap-2">
            {club.departments.map((d) => (
              <span key={d} className="sticker bg-sky text-sm">
                {d}
              </span>
            ))}
          </div>
        </motion.section>
      )}

      {/* 活动列表 */}
      <motion.section {...fadeUp} className="space-y-3">
        <h2 className="text-2xl font-black text-ink">品牌活动</h2>
        {activities === null ? (
          <p className="card p-6 text-center text-sm font-bold text-ink/40">活动加载中…</p>
        ) : activities.length === 0 ? (
          <p className="card p-6 text-center text-sm font-bold text-ink/40">
            🎪 活动筹备中，敬请期待～
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map((a) => (
              <div
                key={a.id}
                className="card overflow-hidden transition-transform hover:-translate-y-1"
              >
                {a.cover_url && (
                  <div className="img-fallback aspect-[4/3] w-full overflow-hidden border-b-[3px] border-ink">
                    <img
                      src={a.cover_url}
                      alt={a.title}
                      width={400}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="space-y-2 p-5">
                  <h3 className="text-lg font-black text-ink">{a.title}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed font-bold text-ink/50">
                    {a.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {a.location && (
                      <span className="sticker bg-cream text-[10px]">📍 {a.location}</span>
                    )}
                    {a.starts_at && (
                      <span className="sticker bg-cream text-[10px]">
                        🗓 {new Date(a.starts_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* 工作人员入口 */}
      {isStaff && (
        <motion.section {...fadeUp} className="grid gap-4 sm:grid-cols-2">
          <Link
            to={`/c/${slug}/redeem`}
            className="card flex items-center gap-3 bg-lemon/40 p-5 transition-transform hover:-translate-y-1"
          >
            <span className="text-3xl">🎫</span>
            <div>
              <p className="font-black text-ink">核销台</p>
              <p className="text-xs font-bold text-ink/50">现场扫码/输码发奖</p>
            </div>
          </Link>
          {club.my_role === 'admin' && (
            <Link
              to={`/c/${slug}/admin`}
              className="card flex items-center gap-3 bg-sky/40 p-5 transition-transform hover:-translate-y-1"
            >
              <span className="text-3xl">🛠️</span>
              <div>
                <p className="font-black text-ink">社团后台</p>
                <p className="text-xs font-bold text-ink/50">奖池、活动、成员、数据管理</p>
              </div>
            </Link>
          )}
        </motion.section>
      )}
    </div>
  )
}
