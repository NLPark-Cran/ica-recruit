import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { PoolConfig, Prize, PrizeIn } from '@/lib/types'

const inputCls =
  'min-h-11 w-full rounded-xl border-2 border-ink/40 bg-white px-3 text-sm outline-none focus:border-ink'

const EMPTY_PRIZE = (round: number): PrizeIn => ({
  round,
  name: '',
  tier: '参与奖',
  image_url: '',
  total_stock: 0,
  weight: 100,
  daily_quota: 0,
  is_virtual: false,
  active: true,
  sort: 0,
})

export default function PrizesTab({ base }: { base: string }) {
  const { toast } = useToast()
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [configs, setConfigs] = useState<PoolConfig[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await api.get<{ prizes: Prize[]; configs: PoolConfig[] }>(`${base}/admin/prizes`)
      setPrizes(data.prizes)
      setConfigs(data.configs)
    } catch (e) {
      toast(errorMessage(e, '奖池加载失败'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <p className="py-10 text-center text-sm text-ink/50">奖池加载中…</p>

  return (
    <div className="space-y-10">
      {[1, 2].map((round) => (
        <section key={round} className="space-y-4">
          <h3 className="text-lg font-black text-ink">第 {round} 轮奖池</h3>
          <PoolConfigCard
            base={base}
            round={round}
            config={configs.find((c) => c.round === round)}
            onSaved={() => void load()}
          />
          <div className="space-y-3">
            {prizes
              .filter((p) => p.round === round)
              .map((p) => (
                <PrizeRow key={p.id} base={base} prize={p} onChanged={() => void load()} />
              ))}
          </div>
          <NewPrizeForm base={base} round={round} onCreated={() => void load()} />
        </section>
      ))}
    </div>
  )
}

function PoolConfigCard({
  base,
  round,
  config,
  onSaved,
}: {
  base: string
  round: number
  config?: PoolConfig
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    lose_weight: config?.lose_weight ?? 100,
    enabled: config?.enabled ?? true,
    title: config?.title ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config)
      setForm({ lose_weight: config.lose_weight, enabled: config.enabled, title: config.title })
  }, [config])

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await api.put(`${base}/admin/pool/${round}`, form)
      toast(`第 ${round} 轮配置已保存`, 'success')
      onSaved()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-ink bg-cream p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-32">
          <span className="mb-1 block text-xs font-bold text-ink/60">轮次标题</span>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="如：进群礼"
            maxLength={64}
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-xs font-bold text-ink/60">未中奖权重</span>
          <input
            className={inputCls}
            type="number"
            min={0}
            inputMode="numeric"
            value={form.lose_weight}
            onChange={(e) => setForm({ ...form, lose_weight: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-5 w-5 accent-ink"
          />
          开启本轮
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white shadow-sticker disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存配置'}
        </button>
      </div>
    </div>
  )
}

function PrizeRow({
  base,
  prize,
  onChanged,
}: {
  base: string
  prize: Prize
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<PrizeIn>({
    round: prize.round,
    name: prize.name,
    tier: prize.tier,
    image_url: prize.image_url,
    total_stock: prize.total_stock,
    weight: prize.weight,
    daily_quota: prize.daily_quota,
    is_virtual: prize.is_virtual,
    active: prize.active,
    sort: prize.sort,
  })
  const [saving, setSaving] = useState(false)
  const [codes, setCodes] = useState('')
  const [showCodes, setShowCodes] = useState(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await api.put(`${base}/admin/prizes/${prize.id}`, form)
      toast('奖品已保存', 'success')
      onChanged()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`确定删除/下架奖品「${prize.name}」吗？`)) return
    try {
      await api.del(`${base}/admin/prizes/${prize.id}`)
      toast('已删除（若已被抽中则自动改为下架）', 'success')
      onChanged()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const importCodes = async () => {
    if (!codes.trim()) return
    try {
      const res = await api.post<{ imported: number }>(`${base}/admin/prizes/${prize.id}/codes`, {
        codes,
      })
      toast(`成功导入 ${res.imported} 个兑换码`, 'success')
      setCodes('')
      setShowCodes(false)
      onChanged()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <div
      className={`rounded-2xl border-2 bg-white p-4 shadow-sticker ${
        form.active ? 'border-ink' : 'border-ink opacity-60'
      }`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-bold text-ink/60">名称</span>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={64}
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-xs font-bold text-ink/60">档位</span>
          <input
            className={inputCls}
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            maxLength={16}
          />
        </label>
        <NumberField
          label="库存"
          value={form.total_stock}
          onChange={(v) => setForm({ ...form, total_stock: v })}
        />
        <NumberField
          label="权重"
          value={form.weight}
          onChange={(v) => setForm({ ...form, weight: v })}
        />
        <NumberField
          label="日投放"
          value={form.daily_quota}
          onChange={(v) => setForm({ ...form, daily_quota: v })}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-5 w-5 accent-ink"
          />
          上架
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white shadow-sticker disabled:opacity-50"
          >
            {saving ? '…' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="min-h-11 rounded-full border-2 border-blush/40 px-4 text-sm font-bold text-blush hover:bg-blush/10"
          >
            删除
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50">
        <span>
          已发 {prize.issued}/{prize.total_stock}
        </span>
        {prize.is_virtual && (
          <>
            <span>剩余兑换码 {prize.codes_left ?? 0}</span>
            <button
              type="button"
              onClick={() => setShowCodes(!showCodes)}
              className="font-bold text-ink underline underline-offset-2"
            >
              {showCodes ? '收起导入' : '导入兑换码'}
            </button>
          </>
        )}
        {prize.is_virtual && (
          <span className="rounded bg-sky/20 px-2 py-0.5 font-bold">虚拟奖品</span>
        )}
      </div>
      {showCodes && prize.is_virtual && (
        <div className="mt-3 space-y-2">
          <textarea
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder={'粘贴兑换码，一行一个\n例如：\nTOKEN-AAAA-1111\nTOKEN-BBBB-2222'}
            className="min-h-24 w-full rounded-xl border-2 border-ink/40 p-3 font-mono text-xs outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={() => void importCodes()}
            className="min-h-11 rounded-full bg-leaf px-5 text-sm font-bold text-ink"
          >
            确认导入
          </button>
        </div>
      )}
    </div>
  )
}

function NewPrizeForm({
  base,
  round,
  onCreated,
}: {
  base: string
  round: number
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PrizeIn>(EMPTY_PRIZE(round))
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await api.post(`${base}/admin/prizes`, form)
      toast('奖品已创建', 'success')
      setForm(EMPTY_PRIZE(round))
      setOpen(false)
      onCreated()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-2xl border-2 border-dashed border-ink/30 text-sm font-bold text-ink/60 transition-colors hover:border-ink hover:text-ink"
      >
        ＋ 新增第 {round} 轮奖品
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border-2 border-ink/20 bg-white p-4 shadow-sticker"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-bold text-ink/60">名称 *</span>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={64}
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-xs font-bold text-ink/60">档位</span>
          <input
            className={inputCls}
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            maxLength={16}
          />
        </label>
        <NumberField
          label="库存"
          value={form.total_stock}
          onChange={(v) => setForm({ ...form, total_stock: v })}
        />
        <NumberField
          label="权重"
          value={form.weight}
          onChange={(v) => setForm({ ...form, weight: v })}
        />
        <NumberField
          label="日投放"
          value={form.daily_quota}
          onChange={(v) => setForm({ ...form, daily_quota: v })}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={form.is_virtual}
            onChange={(e) => setForm({ ...form, is_virtual: e.target.checked })}
            className="h-5 w-5 accent-ink"
          />
          虚拟奖品
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-full bg-blush px-6 text-sm font-bold text-white shadow-sticker disabled:opacity-50"
        >
          {saving ? '创建中…' : '创建奖品'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-full border-2 border-ink/20 px-5 text-sm font-bold text-ink"
        >
          取消
        </button>
      </div>
    </form>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="w-24">
      <span className="mb-1 block text-xs font-bold text-ink/60">{label}</span>
      <input
        className={inputCls}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}
