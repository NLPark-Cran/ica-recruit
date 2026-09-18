import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import QrScanner from 'qr-scanner'
import { Forbidden } from '@/components/Protected'
import { api, ApiError, errorMessage } from '@/lib/api'
import { clubRole } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/lib/toast'
import type { RedeemOut } from '@/lib/types'

// ---------- 类型与常量 ----------

type CamMode = 'auto' | 'front' | 'back'

interface CamPref {
  mode: CamMode
  deviceId?: string
}

interface ResultItem {
  id: number
  code: string
  kind: 'ok' | 'fail' | 'queued'
  title: string
  detail: string
  ts: number
}

interface QueuedItem {
  code: string
  ts: number
  error?: string
}

/** 排除长焦/微距等不适合扫码的镜头 */
const BAD_LENS = /tele|长焦|macro|微距|ultra.?zoom|periscope|潜望/i
/** 优先选择广角/主摄/后置 */
const GOOD_LENS = /wide|主摄|main|back|rear|后置|广角/i

function pickBestCamera(cameras: QrScanner.Camera[]): QrScanner.Camera | null {
  if (cameras.length === 0) return null
  const usable = cameras.filter((c) => !BAD_LENS.test(c.label))
  const pool = usable.length > 0 ? usable : cameras
  return pool.find((c) => GOOD_LENS.test(c.label)) ?? pool[0]
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 存储不可用时忽略 */
  }
}

// ---------- 主页面 ----------

/** 社团连续扫码核销台（本社团 staff/admin 可用） */
export default function Redeem() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const base = `/api/clubs/${slug}`

  const role = clubRole(user, slug)
  const queueKey = `ica:queue:${slug}:${user?.id ?? 'anon'}`

  const [offlineMode, setOfflineMode] = useState(false)
  const [results, setResults] = useState<ResultItem[]>([])
  const [queue, setQueue] = useState<QueuedItem[]>([])
  const [submittingQueue, setSubmittingQueue] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const seqRef = useRef(0)
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 })
  const audioRef = useRef<AudioContext | null>(null)
  const offlineRef = useRef(offlineMode)
  offlineRef.current = offlineMode

  // 页面加载时恢复本机暂存队列
  useEffect(() => {
    const saved = loadJson<QueuedItem[]>(queueKey)
    if (saved && saved.length > 0) {
      setQueue(saved)
      toast(`本机还有 ${saved.length} 条暂存记录未提交，恢复网络后请手动提交`, 'error')
    }
  }, [queueKey, toast])

  const persistQueue = useCallback(
    (items: QueuedItem[]) => {
      setQueue(items)
      saveJson(queueKey, items)
    },
    [queueKey],
  )

  // 提示音：成功高音短促，失败低音较长
  const playBeep = useCallback((ok: boolean) => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioRef.current ??= new Ctor()
      const ctx = audioRef.current
      void ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = ok ? 'sine' : 'square'
      osc.frequency.value = ok ? 1046 : 196
      const dur = ok ? 0.15 : 0.4
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + dur)
    } catch {
      /* 音频不可用时忽略 */
    }
  }, [])

  const buzz = useCallback((ok: boolean) => {
    try {
      navigator.vibrate?.(ok ? 60 : [160, 80, 160])
    } catch {
      /* 不支持震动则忽略 */
    }
  }, [])

  const pushResult = useCallback((item: Omit<ResultItem, 'id' | 'ts'>) => {
    const entry: ResultItem = { ...item, id: ++seqRef.current, ts: Date.now() }
    setResults((prev) => [entry, ...prev].slice(0, 50))
  }, [])

  /** 联网立即核销；网络失败自动转入本机暂存 */
  const processCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase()
      if (!code) return

      // 暂存模式：直接入队
      if (offlineRef.current) {
        persistQueue([...queue, { code, ts: Date.now() }])
        pushResult({
          code,
          kind: 'queued',
          title: '📥 已暂存本机',
          detail: '弱网暂存模式：恢复网络后需手动提交，暂存不等于核销成功',
        })
        playBeep(true)
        buzz(true)
        return
      }

      try {
        const res = await api.post<RedeemOut>(`${base}/redeem`, { code })
        if (res.ok) {
          pushResult({
            code,
            kind: 'ok',
            title: `✅ ${res.prize_name}${res.round ? ` · 第 ${res.round} 轮` : ''}`,
            detail: `${res.winner_nickname ? `中奖人：${res.winner_nickname} · ` : ''}${res.message}`,
          })
        } else {
          pushResult({ code, kind: 'fail', title: '❌ 核销失败', detail: res.message })
        }
        playBeep(res.ok)
        buzz(res.ok)
      } catch (e) {
        // 服务器明确拒绝（403 等）→ 失败卡；网络层失败 → 自动转入暂存
        if (e instanceof ApiError && e.status > 0) {
          pushResult({ code, kind: 'fail', title: '❌ 核销失败', detail: e.message })
          playBeep(false)
          buzz(false)
        } else {
          persistQueue([...queue, { code, ts: Date.now(), error: '网络失败自动暂存' }])
          pushResult({
            code,
            kind: 'queued',
            title: '📥 网络失败，已自动暂存',
            detail: '恢复网络后请在下方手动提交',
          })
          playBeep(false)
          buzz(false)
          toast('网络异常，该码已自动转入本机暂存', 'error')
        }
      }
    },
    [base, queue, persistQueue, pushResult, playBeep, buzz, toast],
  )

  /** 扫码入口：同码 5 秒防抖 */
  const handleScan = useCallback(
    (raw: string) => {
      const code = raw.trim().toUpperCase()
      if (code.length < 4) return
      const now = Date.now()
      const last = lastScanRef.current
      if (last.code === code && now - last.ts < 5000) return
      lastScanRef.current = { code, ts: now }
      void processCode(code)
    },
    [processCode],
  )

  /** 手动提交全部暂存：成功移除、失败保留并显示原因 */
  const submitQueue = async () => {
    if (submittingQueue || queue.length === 0) return
    setSubmittingQueue(true)
    const remaining: QueuedItem[] = []
    let okCount = 0
    for (const item of queue) {
      try {
        const res = await api.post<RedeemOut>(`${base}/redeem`, { code: item.code })
        if (res.ok) {
          okCount++
          pushResult({
            code: item.code,
            kind: 'ok',
            title: `✅ ${res.prize_name}${res.round ? ` · 第 ${res.round} 轮` : ''}`,
            detail: `${res.winner_nickname ? `中奖人：${res.winner_nickname} · ` : ''}${res.message}`,
          })
        } else {
          remaining.push({ ...item, error: res.message })
        }
      } catch (e) {
        remaining.push({ ...item, error: errorMessage(e, '提交失败') })
      }
    }
    persistQueue(remaining)
    setSubmittingQueue(false)
    if (okCount > 0) {
      playBeep(true)
      toast(`已提交 ${okCount} 条${remaining.length > 0 ? `，${remaining.length} 条失败待处理` : ''}`, 'success')
    } else if (remaining.length > 0) {
      playBeep(false)
      toast('全部提交失败，请检查网络后重试', 'error')
    }
  }

  const submitManual = () => {
    const code = manualCode.trim().toUpperCase()
    if (code.length < 4) return
    setManualCode('')
    void processCode(code)
  }

  if (role !== 'staff' && role !== 'admin') {
    return <Forbidden hint="核销台仅对本社团的工作人员/管理员开放。" />
  }

  const latest = results[0]

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-ink">连续扫码核销台 🎫</h1>
          <p className="text-sm font-bold text-ink/50">相机常开，扫到即核销，无需任何点击</p>
        </div>
        <span className="sticker bg-white">👤 核销员：{user?.nickname}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* 左栏：相机 + 手工输入 */}
        <div className="space-y-4">
          <Scanner slug={slug} onScan={handleScan} />

          {/* 手工输入兜底 */}
          <div className="card flex gap-2 p-4">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              placeholder="手动输入核销码"
              autoCapitalize="characters"
              autoCorrect="off"
              maxLength={24}
              className="input flex-1 font-mono font-black tracking-widest uppercase placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
            />
            <button
              type="button"
              onClick={submitManual}
              disabled={manualCode.trim().length < 4}
              className="btn-lemon shrink-0"
            >
              核销
            </button>
          </div>
        </div>

        {/* 右栏：结果卡 + 暂存队列 + 本页最近结果 */}
        <div className="space-y-4">
          {/* 最新结果大卡 */}
          <div className="card min-h-36 p-5">
            {latest ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={latest.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`-m-2 rounded-2xl border-[3px] border-ink p-4 ${
                    latest.kind === 'ok'
                      ? 'bg-leaf/25'
                      : latest.kind === 'fail'
                        ? 'bg-blush/40'
                        : 'bg-lemon/50'
                  }`}
                  role="alert"
                >
                  <p className="text-xl font-black text-ink">{latest.title}</p>
                  <p className="mt-1 text-sm font-bold break-all text-ink/70">{latest.detail}</p>
                  <p className="mt-2 font-mono text-xs font-bold text-ink/40">
                    {latest.code} · {new Date(latest.ts).toLocaleTimeString('zh-CN')}
                  </p>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <span className="text-4xl">📷</span>
                <p className="text-sm font-bold text-ink/40">
                  对准中奖者出示的二维码
                  <br />
                  扫到后这里会即时显示结果
                </p>
              </div>
            )}
          </div>

          {/* 弱网暂存 */}
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex rounded-full border-[3px] border-ink bg-white p-1 shadow-sticker-sm">
                {(
                  [
                    { key: false, label: '⚡ 联网立即核销' },
                    { key: true, label: '📥 弱网暂存' },
                  ] as const
                ).map((m) => (
                  <button
                    key={String(m.key)}
                    type="button"
                    onClick={() => setOfflineMode(m.key)}
                    className={`min-h-9 rounded-full px-3 text-xs font-black transition-colors ${
                      offlineMode === m.key ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="sticker bg-lemon">待提交 {queue.length}</span>
            </div>

            {queue.length > 0 && (
              <>
                <p className="rounded-2xl border-[3px] border-ink bg-lemon/40 px-3 py-2 text-xs font-black text-ink">
                  ⚠️ 这里只是本机暂存，不等于核销成功，恢复网络后需手动提交
                </p>
                <ul className="max-h-36 space-y-1 overflow-y-auto">
                  {queue.map((item, i) => (
                    <li
                      key={`${item.code}-${i}`}
                      className="rounded-xl bg-cream px-3 py-2 text-xs font-bold"
                    >
                      <span className="font-mono font-black">{item.code}</span>
                      {item.error && <span className="ml-2 text-ink/50">· {item.error}</span>}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => void submitQueue()}
                  disabled={submittingQueue}
                  className="btn-sky w-full"
                >
                  {submittingQueue ? '提交中…' : `📤 手动提交全部（${queue.length}）`}
                </button>
              </>
            )}
          </div>

          {/* 本页最近结果（仅本次会话） */}
          <div className="card p-4">
            <p className="mb-2 text-sm font-black text-ink">
              本页最近结果 <span className="text-xs font-bold text-ink/40">（仅本次会话，刷新清空）</span>
            </p>
            {results.length === 0 ? (
              <p className="py-4 text-center text-xs font-bold text-ink/40">暂无记录</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 rounded-xl border-2 border-ink/10 px-3 py-2 text-xs font-bold ${
                      r.kind === 'ok' ? 'bg-leaf/15' : r.kind === 'fail' ? 'bg-blush/25' : 'bg-lemon/30'
                    }`}
                  >
                    <span aria-hidden>{r.kind === 'ok' ? '✅' : r.kind === 'fail' ? '❌' : '📥'}</span>
                    <span className="min-w-0 flex-1 truncate">{r.title.replace(/^[✅❌📥] /u, '')}</span>
                    <span className="shrink-0 text-ink/40">
                      {new Date(r.ts).toLocaleTimeString('zh-CN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- 连续扫码组件 ----------

/** qr-scanner 连续扫码：相机常开、镜头优选/记忆/切换、连续对焦 */
function Scanner({ slug, onScan }: { slug: string; onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([])
  const [mode, setMode] = useState<CamMode>(() => loadJson<CamPref>(`ica:cam:${slug}`)?.mode ?? 'auto')

  const prefKey = `ica:cam:${slug}`

  /** 连续对焦 + 最小 zoom + 720p 目标分辨率 */
  const tuneTrack = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    const track = stream?.getVideoTracks()[0]
    if (!track) return
    try {
      const caps = (track.getCapabilities?.() ?? {}) as {
        zoom?: { min: number }
        focusMode?: string[]
      }
      const constraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
      const advanced: MediaTrackConstraintSet[] = []
      if (caps.zoom) advanced.push({ zoom: caps.zoom.min } as MediaTrackConstraintSet)
      if (caps.focusMode?.includes('continuous'))
        advanced.push({ focusMode: 'continuous' } as MediaTrackConstraintSet)
      if (advanced.length > 0) constraints.advanced = advanced
      void track.applyConstraints(constraints)
    } catch {
      /* 不支持则忽略 */
    }
  }, [])

  // 初始化扫码器（相机常开，常驻扫码）
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let disposed = false
    const pref = loadJson<CamPref>(prefKey)

    const scanner = new QrScanner(video, (res) => onScanRef.current(res.data), {
      returnDetailedScanResult: true,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 10,
      preferredCamera: pref?.mode === 'front' ? 'user' : 'environment',
    })
    scannerRef.current = scanner

    const boot = async () => {
      try {
        await scanner.start()
        if (disposed) return
        const cams = await QrScanner.listCameras(true)
        if (disposed) return
        setCameras(cams)

        if (pref?.mode !== 'front' && cams.length > 0) {
          // 记忆镜头优先，失效则自动优选（排除长焦/微距）
          const remembered = pref?.deviceId ? cams.find((c) => c.id === pref.deviceId) : null
          const target = remembered ?? pickBestCamera(cams)
          if (target) await scanner.setCamera(target.id)
        }
        if (disposed) return
        tuneTrack()
      } catch {
        if (!disposed) setError('无法打开摄像头，请检查权限，或使用下方手动输入')
      }
    }
    void boot()

    return () => {
      disposed = true
      scanner.destroy()
      scannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefKey])

  /** 切换指定摄像头并记住选择 */
  const selectCamera = async (id: string, nextMode: CamMode) => {
    try {
      await scannerRef.current?.setCamera(id)
      saveJson(prefKey, { mode: nextMode, deviceId: id } satisfies CamPref)
      tuneTrack()
    } catch {
      setError('切换镜头失败，请重试')
    }
  }

  /** 循环切换镜头 */
  const switchCamera = async () => {
    if (cameras.length < 2) return
    const stream = videoRef.current?.srcObject as MediaStream | null
    const currentLabel = stream?.getVideoTracks()[0]?.label ?? ''
    const idx = cameras.findIndex((c) => c.label === currentLabel)
    const next = cameras[(idx + 1) % cameras.length]
    await selectCamera(next.id, mode === 'front' ? 'front' : 'back')
  }

  /** 自动 / 前置 / 后置 快捷切换 */
  const applyMode = async (m: CamMode) => {
    setMode(m)
    if (m === 'front') {
      try {
        await scannerRef.current?.setCamera('user')
        saveJson(prefKey, { mode: 'front' } satisfies CamPref)
        tuneTrack()
      } catch {
        setError('无法打开前置摄像头')
      }
      return
    }
    if (m === 'back') {
      const back = cameras.filter((c) => !/front|前置|user/i.test(c.label))
      const target = pickBestCamera(back.length > 0 ? back : cameras)
      if (target) await selectCamera(target.id, 'back')
      return
    }
    // auto：清除记忆设备，自动优选
    saveJson(prefKey, { mode: 'auto' } satisfies CamPref)
    const target = pickBestCamera(cameras)
    if (target) await selectCamera(target.id, 'auto')
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-[3px] border-ink bg-black [&>video]:h-full [&>video]:w-full [&>video]:object-cover">
        {/* qr-scanner 会把 video 移入此容器并叠加高亮画布 */}
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {/* 取景框 */}
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-2xl border-4 border-dashed border-lemon/90" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80 p-6 text-center text-sm font-bold text-white">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-full border-[3px] border-ink bg-white p-1 shadow-sticker-sm">
          {(
            [
              { key: 'auto', label: '自动' },
              { key: 'front', label: '前置' },
              { key: 'back', label: '后置' },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => void applyMode(m.key)}
              className={`min-h-9 rounded-full px-3 text-xs font-black transition-colors ${
                mode === m.key ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {cameras.length > 1 && (
          <button type="button" onClick={() => void switchCamera()} className="btn-sky min-h-9 px-3 py-1 text-xs">
            🔄 切换镜头
          </button>
        )}
      </div>
    </div>
  )
}
