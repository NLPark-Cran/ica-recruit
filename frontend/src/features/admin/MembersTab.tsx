import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { ClubRole, Member } from '@/lib/types'

/** 成员管理：列表 + 按观猹 ID 添加 staff/admin + 移除 */
export default function MembersTab({ base }: { base: string }) {
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [watchaId, setWatchaId] = useState('')
  const [role, setRole] = useState<ClubRole>('staff')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: Member[] }>(`${base}/members`)
      setMembers(data.items)
    } catch (e) {
      toast(errorMessage(e, '成员列表加载失败'), 'error')
    }
  }, [base, toast])

  useEffect(() => {
    void load()
  }, [load])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const id = Number(watchaId.trim())
    if (!id || adding) return
    setAdding(true)
    try {
      await api.post(`${base}/members`, { watcha_user_id: id, role })
      toast('成员已添加/更新', 'success')
      setWatchaId('')
      void load()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setAdding(false)
    }
  }

  const remove = async (m: Member) => {
    if (!window.confirm(`确定移除成员「${m.nickname}」吗？`)) return
    try {
      await api.del(`${base}/members/${m.watcha_user_id}`)
      toast('已移除', 'success')
      void load()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  if (!members)
    return <p className="py-10 text-center text-sm font-bold text-ink/50">成员加载中…</p>

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5">
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-black text-ink/60">观猹用户 ID</span>
          <input
            className="input"
            value={watchaId}
            onChange={(e) => setWatchaId(e.target.value.replace(/\D/g, ''))}
            placeholder="如 1001（对方需先登录一次）"
            inputMode="numeric"
          />
        </label>
        <label className="w-32">
          <span className="mb-1 block text-xs font-black text-ink/60">角色</span>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as ClubRole)}
          >
            <option value="staff">工作人员</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <button type="submit" disabled={adding || !watchaId.trim()} className="btn-lemon">
          {adding ? '添加中…' : '＋ 添加成员'}
        </button>
      </form>

      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.watcha_user_id} className="card flex items-center gap-3 p-4">
            {m.avatar_url ? (
              <img
                src={m.avatar_url}
                alt={m.nickname}
                className="h-10 w-10 rounded-full border-2 border-ink object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-sky text-sm font-black">
                {m.nickname.slice(0, 1) || '?'}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-ink">{m.nickname}</p>
              <p className="text-xs font-bold text-ink/40">观猹 ID：{m.watcha_user_id}</p>
            </div>
            <span className={`sticker shrink-0 ${m.role === 'admin' ? 'bg-lemon' : 'bg-sky'}`}>
              {m.role === 'admin' ? '管理员' : '工作人员'}
            </span>
            <button
              type="button"
              onClick={() => void remove(m)}
              className="btn-ghost shrink-0 px-4 text-xs"
            >
              移除
            </button>
          </li>
        ))}
        {members.length === 0 && (
          <li className="card p-6 text-center text-sm font-bold text-ink/40">暂无成员</li>
        )}
      </ul>
    </div>
  )
}
