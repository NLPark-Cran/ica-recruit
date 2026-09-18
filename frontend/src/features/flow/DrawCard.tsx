import { useState } from 'react'
import { motion } from 'motion/react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { DrawResult, RoundStatus } from '@/lib/types'
import ResultModal from './ResultModal'

interface Props {
  /** 社团级 API 前缀，如 /api/clubs/ica */
  base: string
  round: RoundStatus
  /** 抽奖成功后通知父组件刷新状态 */
  onDrawn: () => void
}

/** 单轮抽奖卡片：点击 → 转盘动效 → 结果弹层 */
export default function DrawCard({ base, round, onDrawn }: Props) {
  const { toast } = useToast()
  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<DrawResult | null>(round.result)
  const [showModal, setShowModal] = useState(false)

  const locked = !round.enabled || !round.eligible
  const lockReason = !round.enabled
    ? '本轮抽奖暂未开启'
    : !round.eligible
      ? round.round === 2
        ? '完成报名表后解锁 🔒'
        : '暂不符合抽奖条件'
      : ''

  const draw = async () => {
    if (drawing || round.drawn || locked) return
    setDrawing(true)
    try {
      const [res] = await Promise.all([
        api.post<DrawResult>(`${base}/lottery/draw/${round.round}`),
        // 至少转 1.6s，保证动效完整
        new Promise((r) => window.setTimeout(r, 1600)),
      ])
      setResult(res)
      setShowModal(true)
      onDrawn()
    } catch (e) {
      toast(errorMessage(e, '抽奖失败，请稍后再试'), 'error')
    } finally {
      setDrawing(false)
    }
  }

  return (
    <div className="card relative overflow-hidden p-6">
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/70 backdrop-blur-[2px]">
          <span className="sticker bg-ink text-sm text-white">{lockReason}</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 text-center">
        <motion.div
          animate={drawing ? { rotate: [0, 360, 720, 1080], scale: [1, 1.15, 1] } : { rotate: 0 }}
          transition={drawing ? { duration: 1.6, ease: 'easeInOut' } : { duration: 0.3 }}
          className="flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-ink bg-lemon text-5xl shadow-sticker"
          aria-hidden
        >
          {round.drawn ? (result?.win ? '🎁' : '🍀') : '🎡'}
        </motion.div>

        {round.drawn && result ? (
          <div className="space-y-1">
            <p className="text-lg font-black text-ink">
              {result.win ? `已中奖：${result.prize_name}` : '已参与，未中奖'}
            </p>
            <p className="text-xs font-bold text-ink/50">每人每轮仅可抽一次</p>
            <button type="button" onClick={() => setShowModal(true)} className="btn-sky mt-2">
              查看我的结果
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={draw}
            disabled={drawing || locked}
            className="btn-lemon min-h-12 w-full max-w-56 text-base"
          >
            {drawing ? '抽奖中…' : '立即抽奖'}
          </button>
        )}
      </div>

      {showModal && result && <ResultModal result={result} onClose={() => setShowModal(false)} />}
    </div>
  )
}
