import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, ApiError, errorMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const SLUG_RE = /^[a-z0-9-]{2,32}$/

/** 社团入驻表单：创建后自动成为管理员并跳转社团后台 */
export default function NewClub() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [form, setForm] = useState({
    name: '',
    slug: '',
    intro: '',
    departments: [] as string[],
    contact: '',
    card_url: '',
  })
  const [newDept, setNewDept] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const slugTouched = form.slug.length > 0
  const slugValid = SLUG_RE.test(form.slug)

  const addDept = () => {
    const d = newDept.trim()
    if (!d || form.departments.includes(d) || form.departments.length >= 10) return
    setForm({ ...form, departments: [...form.departments, d] })
    setNewDept('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!form.name.trim()) {
      setError('请填写社团名称')
      return
    }
    if (!slugValid) {
      setError('标识仅限小写字母、数字与连字符（2-32 位）')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await api.post('/api/clubs', {
        slug: form.slug,
        name: form.name.trim(),
        intro: form.intro,
        logo_url: '',
        departments: form.departments,
        card_url: form.card_url.trim(),
        contact: form.contact,
      })
      await refresh() // 刷新 club_roles
      navigate(`/c/${form.slug}/admin`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('该标识已被使用，换一个试试')
      } else {
        setError(errorMessage(err, '创建失败，请稍后再试'))
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-ink">社团入驻 🚀</h1>
        <p className="text-sm font-bold text-ink/50">
          填写基本信息即可创建你的社团招新站，抽奖、报名、核销、AI 全部开箱即用
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">社团名称 *</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="如：国际交流协会"
            maxLength={64}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">社团标识（slug）*</span>
          <input
            className="input font-mono"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            placeholder="如：ica"
            maxLength={32}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <span
            className={`mt-1.5 block text-xs font-bold ${
              !slugTouched ? 'text-ink/40' : slugValid ? 'text-leaf' : 'text-blush'
            }`}
          >
            {!slugTouched && '仅限小写字母、数字与连字符，创建后不可轻易修改'}
            {slugTouched && slugValid && `✓ 你的社团地址将是 /c/${form.slug}`}
            {slugTouched && !slugValid && '仅限小写字母、数字与连字符（2-32 位）'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">社团简介</span>
          <textarea
            className="input min-h-24 resize-y py-3"
            value={form.intro}
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
            placeholder="一句话介绍你的社团，会展示在社团主页"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-black text-ink">
            部门设置（最多 10 个，可后续修改）
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {form.departments.map((d) => (
              <span key={d} className="sticker bg-sky">
                {d}
                <button
                  type="button"
                  aria-label={`删除部门 ${d}`}
                  onClick={() =>
                    setForm({ ...form, departments: form.departments.filter((x) => x !== d) })
                  }
                  className="ml-1 font-black"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              className="input w-36"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDept()
                }
              }}
              placeholder="新部门名"
              maxLength={16}
            />
            <button type="button" onClick={addDept} className="btn-ghost px-4 text-xs">
              ＋ 添加
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">联系方式</span>
          <input
            className="input"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder="QQ群号 / 微信号 / 公众号，展示在社团主页"
            maxLength={256}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">联名卡链接（可选）</span>
          <input
            className="input"
            value={form.card_url}
            onChange={(e) => setForm({ ...form, card_url: e.target.value })}
            placeholder="留空则默认 https://school.watcha.cn/card"
            maxLength={512}
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
          {submitting ? '创建中…' : '🎉 创建我的社团'}
        </button>
      </form>
    </div>
  )
}
