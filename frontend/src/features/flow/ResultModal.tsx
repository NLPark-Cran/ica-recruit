import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import QrCode from '@/components/QrCode'
import { useToast } from '@/lib/toast'
import type { DrawResult } from '@/lib/types'

interface Props {
  result: DrawResult
  onClose: () => void
}

/** 抽奖结果弹层：实物奖品 → 大二维码 + 全屏核销模式；虚拟奖品 → 兑换码 + 一键复制 */
export default function ResultModal({ result, onClose }: Props) {
  const { toast } = useToast()
  const [fullscreen, setFullscreen] = useState(false)

  const copyCode = async () => {
    if (!result.virtual_code) return
    try {
      await navigator.clipboard.writeText(result.virtual_code)
      toast('兑换码已复制', 'success')
    } catch {
      toast('复制失败，请长按手动复制', 'error')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="mask"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="card safe-bottom w-full max-w-sm p-6 text-center"
        >
          {result.win ? (
            <div className="space-y-4">
              <span className="text-5xl">🎉</span>
              <div>
                <h3 className="text-2xl font-black text-ink">恭喜中奖！</h3>
                <p className="mt-1">
                  {result.prize_tier && (
                    <span className="sticker mr-1 bg-sky">{result.prize_tier}</span>
                  )}
                  <span className="text-sm font-black text-ink">{result.prize_name}</span>
                </p>
              </div>

              {result.is_virtual && result.virtual_code ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-ink/50">虚拟奖品兑换码（请妥善保存）</p>
                  <code className="block rounded-2xl border-[3px] border-ink bg-lemon px-4 py-3 font-mono text-lg font-black break-all tracking-wider text-ink">
                    {result.virtual_code}
                  </code>
                  <button type="button" onClick={copyCode} className="btn-sky w-full">
                    📋 一键复制兑换码
                  </button>
                </div>
              ) : result.code ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-ink/50">
                    {result.redeemed_at ? '该奖品已核销 ✅' : '请向工作人员出示二维码核销领奖'}
                  </p>
                  <div className="flex justify-center">
                    <QrCode text={result.code} size={200} />
                  </div>
                  <code className="block rounded-2xl border-[3px] border-ink bg-cream px-4 py-2 font-mono text-base font-black tracking-widest text-ink">
                    {result.code}
                  </code>
                  {!result.redeemed_at && (
                    <button
                      type="button"
                      onClick={() => setFullscreen(true)}
                      className="btn-lemon w-full"
                    >
                      🔆 全屏核销模式（方便工作人员扫码）
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <span className="text-5xl">🍀</span>
              <h3 className="text-2xl font-black text-ink">差一点点！</h3>
              <p className="text-sm leading-relaxed font-bold text-ink/50">
                这次没有中奖，别灰心～关注群内后续活动通知，还有更多福利等着你！
              </p>
            </div>
          )}

          <button type="button" onClick={onClose} className="btn-ghost mt-5 w-full">
            关闭
          </button>
        </motion.div>
      </motion.div>

      {/* 全屏核销模式：白底高亮，二维码铺满 */}
      {fullscreen && result.code && (
        <motion.div
          key="fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-white p-6"
          onClick={() => setFullscreen(false)}
        >
          <p className="text-sm font-black text-ink/50">请将屏幕对准工作人员的扫码设备</p>
          <QrCode text={result.code} size={Math.min(window.innerWidth - 80, 420)} />
          <code className="font-mono text-2xl font-black tracking-widest text-ink">
            {result.code}
          </code>
          <p className="text-xs font-bold text-ink/40">点击任意位置退出全屏</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
