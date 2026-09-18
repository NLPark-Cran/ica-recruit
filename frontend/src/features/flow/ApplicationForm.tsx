import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { api, ApiError, errorMessage } from '@/lib/api'
import { DEPARTMENTS, type ApplicationIn } from '@/lib/types'

interface Props {
  cardUrl: string
  onSuccess: () => void
}

const GRADES = ['2026 级', '2025 级', '2024 级', '2023 级', '其他']

const inputClass =
  'min-h-12 w-full rounded-2xl border-2 border-grape/15 bg-white px-4 text-base outline-none transition-colors focus:border-grape placeholder:text-grape/30'

export default function ApplicationForm({ cardUrl, onSuccess }: Props) {
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
    if (!form.wechat.trim()) return '请填写微信号，方便我们联系你'
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
      await api.post('/api/applications', { ...form, student_id: form.student_id.trim() })
      setDone(true)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('该学号已提交过报名，如有疑问请联系现场工作人员')
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
        className="flex flex-col items-center gap-4 rounded-3xl border-2 border-mint/40 bg-white p-8 text-center shadow-card"
      >
        <span className="text-5xl">🎊</span>
        <h3 className="text-2xl font-black text-grape">报名成功！</h3>
        <p className="text-sm leading-relaxed text-grape/60">
          我们已收到你的报名表，面试通知将通过微信发送。别忘了领取你的专属纪念：
        </p>
        <div className="w-full rounded-3xl bg-gradient-to-br from-grape via-grape-light to-tangerine p-6 text-white shadow-sticker">
          <p className="text-xs font-bold tracking-widest text-white/70">
            LIMITED NFT-LIKE TOKEN CARD
          </p>
          <p className="mt-2 text-xl font-black">观猹 × 杭电 ICA 联名 Token 虚拟卡</p>
          <button
            type="button"
            onClick={() => window.open(cardUrl, '_blank', 'noopener')}
            className="mt-4 min-h-11 w-full rounded-full bg-white text-sm font-black text-grape transition-transform hover:scale-105 active:scale-95"
          >
            🪙 立即领取（新窗口打开）
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-3xl border-2 border-grape/10 bg-white p-6 shadow-card"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-grape">姓名 *</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="真实姓名"
            maxLength={32}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-grape">学号 *</span>
          <input
            className={inputClass}
            value={form.student_id}
            onChange={(e) => set('student_id', e.target.value.replace(/\D/g, ''))}
            placeholder="纯数字学号"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={32}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-grape">学院</span>
          <input
            className={inputClass}
            value={form.college}
            onChange={(e) => set('college', e.target.value)}
            placeholder="如：计算机学院"
            maxLength={64}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-grape">年级</span>
          <select
            className={inputClass}
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
          <span className="mb-1.5 block text-sm font-bold text-grape">电话 *</span>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="手机号码"
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-grape">微信号 *</span>
          <input
            className={inputClass}
            value={form.wechat}
            onChange={(e) => set('wechat', e.target.value)}
            placeholder="用于接收面试通知"
            maxLength={64}
          />
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-bold text-grape">意向部门 *（可多选）</span>
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map((d) => {
            const active = form.departments.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDepartment(d)}
                aria-pressed={active}
                className={`min-h-11 rounded-full border-2 px-5 text-sm font-bold transition-all active:scale-95 ${
                  active
                    ? 'border-grape bg-grape text-white shadow-sticker'
                    : 'border-grape/20 bg-white text-grape hover:border-grape/50'
                }`}
              >
                {active ? '✓ ' : ''}
                {d}
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.allow_adjust}
          onClick={() => set('allow_adjust', !form.allow_adjust)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
            form.allow_adjust ? 'bg-mint' : 'bg-grape/20'
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
              form.allow_adjust ? 'left-7' : 'left-1'
            }`}
          />
        </button>
        <span className="text-sm font-bold text-grape">是否服从部门调剂</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-grape">自我介绍</span>
        <textarea
          className={`${inputClass} min-h-28 resize-y py-3`}
          value={form.intro}
          onChange={(e) => set('intro', e.target.value)}
          placeholder="聊聊你的兴趣、经历，或为什么想加入 ICA…"
          maxLength={1000}
        />
      </label>

      {error && (
        <div
          className="rounded-2xl bg-tangerine/10 px-4 py-3 text-sm font-bold text-tangerine"
          role="alert"
        >
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-full bg-tangerine text-base font-black text-white shadow-sticker transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      >
        {submitting ? '提交中…' : '提交报名表'}
      </button>
    </form>
  )
}
