import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Forbidden } from '@/components/Protected'
import { api, errorMessage } from '@/lib/api'
import { clubRole } from '@/lib/roles'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/lib/toast'
import type { RedeemHistoryItem, RedeemOut } from '@/lib/types'

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
}

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return w.BarcodeDetector ?? null
}

/** 社团核销台（本社团 staff/admin 可用） */
export default function Redeem() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const base = `/api/clubs/${slug}`
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RedeemOut | null>(null)
  const [history, setHistory] = useState<RedeemHistoryItem[]>([])
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const role = clubRole(user, slug)
  const DetectorCtor = getBarcodeDetector()

  const loadHistory = async () => {
    try {
      const data = await api.get<{ items: RedeemHistoryItem[] }>(`${base}/redeem/history`)
      setHistory(data.items)
    } catch {
      /* 列表失败静默 */
    }
  }

  useEffect(() => {
    if (role === 'staff' || role === 'admin') void loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, base])

  const submit = async (raw?: string) => {
    const c = (raw ?? code).trim().toUpperCase()
    if (!c || submitting) return
    setSubmitting(true)
    try {
      const res = await api.post<RedeemOut>(`${base}/redeem`, { code: c })
      setResult(res)
      setCode('')
      if (res.ok) void loadHistory()
    } catch (e) {
      toast(errorMessage(e, '核销失败，请重试'), 'error')
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  if (role !== 'staff' && role !== 'admin') {
    return <Forbidden hint="核销台仅对本社团的工作人员/管理员开放。" />
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-ink">奖品核销台 🎫</h1>
        <p className="text-sm font-bold text-ink/50">输入或扫描中奖者的核销码，确认后发放奖品</p>
      </div>

      <div className="card space-y-4 p-6">
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="输入核销码，如 AB12CD34"
          autoCapitalize="characters"
          autoCorrect="off"
          maxLength={24}
          className="input min-h-14 text-center font-mono text-2xl font-black tracking-widest uppercase placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-ink/30"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || code.trim().length < 4}
            className="btn-lemon min-h-14 flex-1 text-lg"
          >
            {submitting ? '核销中…' : '确认核销'}
          </button>
          {DetectorCtor && (
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="btn-sky min-h-14 px-6 text-base"
            >
              📷 扫码
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            key={result.code + String(result.ok)}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className={`card p-6 text-center ${result.ok ? 'bg-leaf/20' : 'bg-blush/40'}`}
          >
            <div className="text-4xl">{result.ok ? '✅' : '❌'}</div>
            <p className="mt-2 text-xl font-black text-ink">
              {result.ok ? '核销成功' : '核销失败'}
            </p>
            {result.ok && (
              <p className="mt-1 text-lg font-black text-ink">
                {result.prize_name}
                <span className="sticker ml-2 bg-sky text-[10px]">第 {result.round} 轮</span>
              </p>
            )}
            <p className="mt-2 text-sm font-black text-ink/70">{result.message}</p>
            {!result.ok && result.redeemed_at && (
              <p className="mt-1 text-xs font-bold text-ink/50">
                首次核销时间：{new Date(result.redeemed_at).toLocaleString('zh-CN')}
              </p>
            )}
            <button type="button" onClick={() => setResult(null)} className="btn-ghost mt-4">
              继续核销下一个
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {scanning && DetectorCtor && (
        <Scanner
          Detector={DetectorCtor}
          onDetect={(c) => {
            setScanning(false)
            void submit(c)
          }}
          onClose={() => setScanning(false)}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-black text-ink">最近核销记录</h2>
        {history.length === 0 ? (
          <p className="card p-6 text-center text-sm font-bold text-ink/40">暂无核销记录</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li key={`${h.code}-${i}`} className="card flex items-center gap-3 p-4">
                <span className="text-xl">🎁</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">
                    {h.prize_name}
                    <span className="ml-2 text-xs font-bold text-ink/40">第 {h.round} 轮</span>
                  </p>
                  <p className="font-mono text-xs font-bold text-ink/50">
                    {h.code} · {h.winner}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-ink/40">
                  {h.redeemed_at ? new Date(h.redeemed_at).toLocaleString('zh-CN') : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** 排除长焦/微距等不适合扫码的镜头 */
const BAD_LENS = /tele|长焦|macro|微距|ultra.?zoom|periscope|潜望/i
/** 优先选择广角/主摄/后置 */
const GOOD_LENS = /wide|主摄|main|back|rear|后置|广角/i

/** 从设备列表里挑出最适合扫码的后置主摄 */
function pickBestCamera(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  if (devices.length === 0) return null
  const usable = devices.filter((d) => !BAD_LENS.test(d.label))
  const pool = usable.length > 0 ? usable : devices
  return pool.find((d) => GOOD_LENS.test(d.label)) ?? pool[0]
}

/** 摄像头扫码（BarcodeDetector 可用时渲染）；自动避开长焦/微距镜头，支持手动切换 */
function Scanner({
  Detector,
  onDetect,
  onClose,
}: {
  Detector: BarcodeDetectorCtor
  onDetect: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [camIndex, setCamIndex] = useState(-1) // -1 = 自动选择（优先主摄/广角）
  // 记录最新状态供清理函数使用
  const stateRef = useRef({ cameras, camIndex })
  stateRef.current = { cameras, camIndex }

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    const stopStream = () => {
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }

    /** 尽量把数码变焦拉回最小，避免默认放大 */
    const resetZoom = () => {
      const track = stream?.getVideoTracks()[0]
      if (!track) return
      try {
        const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number } }
        if (caps.zoom) {
          void track.applyConstraints({
            advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet],
          })
        }
      } catch {
        /* 不支持 zoom 控制则忽略 */
      }
    }

    const startDetectLoop = () => {
      const detector = new Detector({ formats: ['qr_code'] })
      const tick = async () => {
        if (stopped || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0 && codes[0].rawValue) {
            onDetect(codes[0].rawValue.trim().toUpperCase())
            return
          }
        } catch {
          /* 单帧识别失败忽略 */
        }
        timer = window.setTimeout(() => void tick(), 300)
      }
      void tick()
    }

    const start = async () => {
      try {
        // 先按 environment 理想约束拿到权限与设备标签
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
        if (stopped) {
          stopStream()
          return
        }

        // 枚举摄像头，自动避开长焦/微距
        const all = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === 'videoinput',
        )
        setCameras(all)

        const { camIndex: idx } = stateRef.current
        const target = idx >= 0 && all[idx] ? all[idx] : all.length > 1 ? pickBestCamera(all) : null

        if (target && target.deviceId) {
          const currentLabel = stream.getVideoTracks()[0]?.label ?? ''
          if (target.label !== currentLabel) {
            stopStream()
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: target.deviceId },
                facingMode: { ideal: 'environment' },
              },
            })
            if (stopped) {
              stopStream()
              return
            }
          }
        }

        resetZoom()

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        startDetectLoop()
      } catch {
        if (!stopped) setError('无法打开摄像头，请检查权限或手动输入')
      }
    }
    void start()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stopStream()
    }
  }, [Detector, onDetect, camIndex])

  const switchCamera = () => {
    if (cameras.length < 2) return
    setCamIndex((i) => (i + 1) % cameras.length)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/80 p-4" onClick={onClose}>
      <div
        className="card m-auto w-full max-w-sm space-y-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-square w-full overflow-hidden rounded-2xl border-[3px] border-ink bg-black">
          {error ? (
            <p className="flex h-full items-center justify-center p-6 text-center text-sm font-bold text-white">
              {error}
            </p>
          ) : (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex gap-2">
          {cameras.length > 1 && (
            <button type="button" onClick={switchCamera} className="btn-sky flex-1">
              🔄 切换镜头
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            取消扫码
          </button>
        </div>
      </div>
    </div>
  )
}
