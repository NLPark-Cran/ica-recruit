import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { ApplicationIn } from '@/lib/types'

interface Props {
  /** 社团级 API 前缀，如 /api/clubs/ica */
  base: string
  /** 意向部门选项（来自 club.departments） */
  departments: string[]
  cardUrl: string
  onSuccess: () => void
}

const GRADES = ['2026 级', '2025 级', '2024 级', '2023 级', '其他']

export default function ApplicationForm({ base, departments, cardUrl, onSuccess }: Props) {
  const [form, setForm] = useState<ApplicationIn>({
    name: '',
    student_id: '',
    college: '',
    grade: '',
    phone: '',
    wechat: '',
    departments: [],
    allow_adjust: true,
    intro: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = <K extends keyof ApplicationIn>(key: K, value: ApplicationIn[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleDepartment = (d: string) =>
    set(
      'departments',
      form.departments.includes(d)
        ? form.departments.filter((x) => x !== d)
        : [...form.departments, d],
    )

  const validate = (): string => {
    if (!form.name.trim()) return '请填写姓名'
    if (!/^\d{4,32}$/.test(form.student_id.trim())) return '学号应为 4-32 位纯数字'
    if (form.phone.trim().length < 5) return '请填写正确的联系电话'
    if (!form.wechat.trim()) return '请填写微信号，方便社团联系你'
    if (departments.length === 0) return '该社团暂未设置部门，暂无法报名'
    if (form.departments.length === 0) return '请至少选择一个意向部门'
    return ''
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await api.post(`${base}/applications`, { ...form, student_id: form.student_id.trim() })
      setDone(true)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('该学号已提交过报名，如有疑问请联系社团工作人员')
      } else {
        setError(errorMessage(err, '提交失败，请检查网络后重试'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card flex flex-col items-center gap-4 p-8 text-center"
      >
        <span className="text-5xl">🎊</span>
        <h3 className="text-2xl font-black text-ink">报名成功！</h3>
        <p className="text-sm leading-relaxed font-bold text-ink/50">
          社团已收到你的报名表，后续通知将通过微信发送。
          {cardUrl && ' 别忘了领取你的专属纪念：'}
        </p>
        {cardUrl && (
          <div className="card w-full bg-gradient-to-br from-sky via-sky-dark to-leaf-light p-6 text-white">
            <p className="text-xs font-black tracking-widest text-white/80">LIMITED TOKEN CARD</p>
            <p className="mt-2 text-xl font-black drop-shadow">观猹 × 社团联名 Token 虚拟卡</p>
            <button
              type="button"
              onClick={() => window.open(cardUrl, '_blank', 'noopener')}
              className="btn-lemon mt-4 w-full"
            >
              🪙 立即领取（新窗口打开）
            </button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">姓名 *</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="真实姓名"
            maxLength={32}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">学号 *</span>
          <input
            className="input"
            value={form.student_id}
            onChange={(e) => set('student_id', e.target.value.replace(/\D/g, ''))}
            placeholder="纯数字学号"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={32}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">学院</span>
          <input
            className="input"
            value={form.college}
            onChange={(e) => set('college', e.target.value)}
            placeholder="如：计算机学院"
            maxLength={64}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">年级</span>
          <select
            className="input"
            value={form.grade}
            onChange={(e) => set('grade', e.target.value)}
          >
            <option value="">请选择</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">电话 *</span>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="手机号码"
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">微信号 *</span>
          <input
            className="input"
            value={form.wechat}
            onChange={(e) => set('wechat', e.target.value)}
            placeholder="用于接收后续通知"
            maxLength={64}
          />
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-black text-ink">意向部门 *（可多选）</span>
        {departments.length === 0 ? (
          <p className="text-sm font-bold text-ink/40">该社团暂未设置部门</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => {
              const active = form.departments.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDepartment(d)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-full border-[3px] border-ink px-5 text-sm font-black transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                    active ? 'bg-lemon shadow-sticker-sm' : 'bg-white shadow-sticker hover:bg-cream'
                  }`}
                >
                  {active ? '✓ ' : ''}
                  {d}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.allow_adjust}
          onClick={() => set('allow_adjust', !form.allow_adjust)}
          className={`relative h-8 w-14 shrink-0 rounded-full border-[3px] border-ink transition-colors ${
            form.allow_adjust ? 'bg-leaf' : 'bg-white'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white transition-all ${
              form.allow_adjust ? 'left-7' : 'left-0.5'
            }`}
          />
        </button>
        <span className="text-sm font-black text-ink">是否服从部门调剂</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-black text-ink">自我介绍</span>
        <textarea
          className="input min-h-28 resize-y py-3"
          value={form.intro}
          onChange={(e) => set('intro', e.target.value)}
          placeholder="聊聊你的兴趣、经历，或为什么想加入我们…"
          maxLength={1000}
        />
      </label>

      {error && (
        <div
          className="rounded-2xl border-[3px] border-ink bg-blush px-4 py-3 text-sm font-black text-ink"
          role="alert"
        >
          ⚠️ {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-lemon min-h-12 w-full text-base">
        {submitting ? '提交中…' : '提交报名表'}
      </button>
    </form>
  )
}
