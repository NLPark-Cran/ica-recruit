import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { Club } from '@/lib/types'

/** 社团设置：编辑名称/简介/logo/部门/联系方式/联名卡链接（PUT /api/clubs/{slug}） */
export default function SettingsTab({ club, onSaved }: { club: Club; onSaved: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    slug: club.slug,
    name: club.name,
    intro: club.intro,
    logo_url: club.logo_url,
    departments: club.departments,
    card_url: club.card_url,
    contact: club.contact,
  })
  const [newDept, setNewDept] = useState('')
  const [saving, setSaving] = useState(false)

  const addDept = () => {
    const d = newDept.trim()
    if (!d || form.departments.includes(d) || form.departments.length >= 10) return
    setForm({ ...form, departments: [...form.departments, d] })
    setNewDept('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim()) {
      toast('请填写社团名称', 'error')
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/clubs/${club.slug}`, form)
      toast('社团设置已保存', 'success')
      onSaved()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <label className="block">
        <span className="mb-1.5 block text-sm font-black text-ink">社团名称 *</span>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={64}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-black text-ink">简介</span>
        <textarea
          className="input min-h-24 resize-y py-3"
          value={form.intro}
          onChange={(e) => setForm({ ...form, intro: e.target.value })}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">Logo URL</span>
          <input
            className="input"
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            placeholder="/assets/xxx.webp"
            maxLength={512}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-ink">联系方式</span>
          <input
            className="input"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder="QQ群 / 微信号 / 公众号…"
            maxLength={256}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-black text-ink">联名卡链接 card_url</span>
        <input
          className="input"
          value={form.card_url}
          onChange={(e) => setForm({ ...form, card_url: e.target.value })}
          placeholder="https://school.watcha.cn/card"
          maxLength={512}
        />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-black text-ink">部门（最多 10 个）</span>
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

      <button type="submit" disabled={saving} className="btn-lemon min-h-12 w-full text-base">
        {saving ? '保存中…' : '保存设置'}
      </button>
    </form>
  )
}
