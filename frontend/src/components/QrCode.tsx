import { useEffect, useRef } from 'react'
import { toCanvas } from 'qrcode'

/** 用 qrcode.toCanvas 渲染二维码；内容变化时重绘 */
export default function QrCode({ text, size = 220 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !text) return
    toCanvas(canvas, text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1d1d1d', light: '#ffffff' },
    }).catch(() => {})
  }, [text, size])

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className="rounded-2xl border-2 border-ink/10 bg-white"
      role="img"
      aria-label={`二维码：${text}`}
    />
  )
}
