import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { Activity, ActivityDraft } from '@/lib/types'

interface ActivityFormState {
  title: string
  summary: string
  detail: string
  location: string
  starts_at: string
  cover_url: string
  published: boolean
  sort: number
}

const EMPTY_FORM: ActivityFormState = {
  title: '',
  summary: '',
  detail: '',
  location: '',
  starts_at: '',
  cover_url: '',
  published: false,
  sort: 0,
}

const inputCls =
  'min-h-11 w-full rounded-xl border-2 border-grape/15 bg-white px-3 text-sm outline-none focus:border-grape'

/** datetime-local 值 → ISO；空则 null */
function toIso(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

function fromIso(v: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ActivitiesTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<Activity[] | null>(null)
  const [editing, setEditing] = useState<ActivityFormState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [keywords, setKeywords] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const data = await api.get<{ items: Activity[] }>('/api/activities/all')
      setItems(data.items)
    } catch (e) {
      toast(errorMessage(e, '活动加载失败'), 'error')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEdit = (a?: Activity) => {
    setEditingId(a?.id ?? null)
    setEditing(
      a
        ? {
            title: a.title,
            summary: a.summary,
            detail: a.detail,
            location: a.location,
            starts_at: fromIso(a.starts_at),
            cover_url: a.cover_url,
            published: a.published,
            sort: a.sort,
          }
        : EMPTY_FORM,
    )
    setKeywords('')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || saving) return
    setSaving(true)
    const body = { ...editing, starts_at: toIso(editing.starts_at) }
    try {
      if (editingId) {
        await api.put(`/api/activities/${editingId}`, body)
        toast('活动已更新', 'success')
      } else {
        await api.post('/api/activities', body)
        toast('活动已创建', 'success')
      }
      setEditing(null)
      void load()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (a: Activity) => {
    try {
      await api.put(`/api/activities/${a.id}`, {
        title: a.title,
        summary: a.summary,
        detail: a.detail,
        location: a.location,
        starts_at: a.starts_at,
        cover_url: a.cover_url,
        published: !a.published,
        sort: a.sort,
      })
      toast(a.published ? '已下架' : '已上架', 'success')
      void load()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const remove = async (a: Activity) => {
    if (!window.confirm(`确定删除活动「${a.title}」吗？`)) return
    try {
      await api.del(`/api/activities/${a.id}`)
      toast('已删除', 'success')
      void load()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const draft = async () => {
    if (!keywords.trim() || drafting) return
    setDrafting(true)
    try {
      const data = await api.post<{ draft: ActivityDraft }>('/api/ai/activity-draft', {
        keywords: keywords.trim(),
      })
      setEditing((f) =>
        f
          ? {
              ...f,
              title: data.draft.title || f.title,
              summary: data.draft.summary || f.summary,
              detail: data.draft.detail || f.detail,
            }
          : f,
      )
      toast('AI 草稿已回填表单，请检查后保存', 'success')
    } catch (e) {
      toast(errorMessage(e, 'AI 起草失败'), 'error')
    } finally {
      setDrafting(false)
    }
  }

  if (!items) return <p className="py-10 text-center text-sm text-grape/50">活动加载中…</p>

  return (
    <div className="space-y-6">
      {!editing && (
        <button
          type="button"
          onClick={() => startEdit()}
          className="min-h-11 w-full rounded-2xl border-2 border-dashed border-grape/30 text-sm font-bold text-grape/60 transition-colors hover:border-grape hover:text-grape"
        >
          ＋ 新增活动
        </button>
      )}

      {editing && (
        <form
          onSubmit={save}
          className="space-y-3 rounded-3xl border-2 border-grape/20 bg-white p-5 shadow-card"
        >
          <h3 className="text-base font-black text-grape">{editingId ? '编辑活动' : '新增活动'}</h3>

          {/* AI 起草 */}
          <div className="flex gap-2 rounded-2xl bg-cream p-3">
            <input
              className={inputCls}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="输入关键词，如：英语角 开学季 破冰"
              maxLength={200}
            />
            <button
              type="button"
              onClick={() => void draft()}
              disabled={drafting || !keywords.trim()}
              className="min-h-11 shrink-0 rounded-full bg-gradient-to-r from-grape to-grape-light px-5 text-sm font-bold text-white shadow-sticker disabled:opacity-50"
            >
              {drafting ? '起草中…' : '✨ AI 起草'}
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-grape/60">标题 *</span>
            <input
              className={inputCls}
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              required
              maxLength={128}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-grape/60">一句话简介</span>
            <input
              className={inputCls}
              value={editing.summary}
              onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
              maxLength={256}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-grape/60">详情</span>
            <textarea
              className={`${inputCls} min-h-24 resize-y py-2`}
              value={editing.detail}
              onChange={(e) => setEditing({ ...editing, detail: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-grape/60">地点</span>
              <input
                className={inputCls}
                value={editing.location}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                maxLength={128}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-grape/60">时间</span>
              <input
                className={inputCls}
                type="datetime-local"
                value={editing.starts_at}
                onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-grape/60">封面图 URL</span>
              <input
                className={inputCls}
                value={editing.cover_url}
                onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })}
                placeholder="/assets/act-1.webp"
                maxLength={512}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-grape/60">排序（小在前）</span>
              <input
                className={inputCls}
                type="number"
                inputMode="numeric"
                value={editing.sort}
                onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-grape">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
              className="h-5 w-5 accent-grape"
            />
            立即上架（公开可见）
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full bg-tangerine px-6 text-sm font-bold text-white shadow-sticker disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存活动'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-11 rounded-full border-2 border-grape/20 px-5 text-sm font-bold text-grape"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-grape/10 bg-white p-4 shadow-card"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-grape">
                {a.title}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                    a.published ? 'bg-mint/20 text-grape' : 'bg-grape/10 text-grape/50'
                  }`}
                >
                  {a.published ? '已上架' : '已下架'}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-grape/50">
                {a.summary || '（无简介）'}
                {a.starts_at && ` · ${new Date(a.starts_at).toLocaleString('zh-CN')}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => startEdit(a)}
                className="min-h-11 rounded-full bg-grape px-4 text-sm font-bold text-white"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => void togglePublish(a)}
                className="min-h-11 rounded-full border-2 border-grape/20 px-4 text-sm font-bold text-grape"
              >
                {a.published ? '下架' : '上架'}
              </button>
              <button
                type="button"
                onClick={() => void remove(a)}
                className="min-h-11 rounded-full border-2 border-tangerine/40 px-4 text-sm font-bold text-tangerine"
              >
                删除
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-2xl bg-white p-6 text-center text-sm text-grape/40 shadow-card">
            暂无活动，点击上方按钮新增
          </li>
        )}
      </ul>
    </div>
  )
}
