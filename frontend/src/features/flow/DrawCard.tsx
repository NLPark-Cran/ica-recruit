import { useState } from 'react'
import { motion } from 'motion/react'
import { api, errorMessage } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { DrawResult, RoundStatus } from '@/lib/types'
import ResultModal from './ResultModal'

interface Props {
  round: RoundStatus
  /** 抽奖成功后通知父组件刷新状态 */
  onDrawn: () => void
}

/** 单轮抽奖卡片：点击 → 转盘动效 → 结果弹层 */
export default function DrawCard({ round, onDrawn }: Props) {
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
        api.post<DrawResult>(`/api/lottery/draw/${round.round}`),
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
    <div className="relative overflow-hidden rounded-3xl border-2 border-grape/10 bg-white p-6 shadow-card">
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/70 backdrop-blur-[2px]">
          <span className="rounded-full bg-grape/80 px-5 py-2 text-sm font-bold text-white">
            {lockReason}
          </span>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 text-center">
        <motion.div
          animate={drawing ? { rotate: [0, 360, 720, 1080], scale: [1, 1.15, 1] } : { rotate: 0 }}
          transition={drawing ? { duration: 1.6, ease: 'easeInOut' } : { duration: 0.3 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-tangerine to-lemon text-5xl shadow-sticker"
          aria-hidden
        >
          {round.drawn ? (result?.win ? '🎁' : '🍀') : '🎡'}
        </motion.div>

        {round.drawn && result ? (
          <div className="space-y-1">
            <p className="text-lg font-black text-grape">
              {result.win ? `已中奖：${result.prize_name}` : '已参与，未中奖'}
            </p>
            <p className="text-xs text-grape/50">每人每轮仅可抽一次</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-2 min-h-11 rounded-full bg-grape px-6 text-sm font-bold text-white shadow-sticker transition-transform active:scale-95"
            >
              查看我的结果
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={draw}
            disabled={drawing || locked}
            className="min-h-12 w-full max-w-56 rounded-full bg-tangerine text-base font-black text-white shadow-sticker transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {drawing ? '抽奖中…' : '立即抽奖'}
          </button>
        )}
      </div>

      {showModal && result && <ResultModal result={result} onClose={() => setShowModal(false)} />}
    </div>
  )
}
