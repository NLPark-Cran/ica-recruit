import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface DropdownProps {
  /** 触发元素的 ref，用于计算浮层位置 */
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 浮层宽度（px） */
  width?: number
}

/**
 * Portal 下拉浮层：渲染到 body，fixed 定位 + 高 z-index，
 * 不会被顶栏 overflow 裁剪；点击外部 / Esc / 滚动均关闭。
 */
export default function Dropdown({
  anchorRef,
  open,
  onClose,
  children,
  width = 224,
}: DropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // 定位：锚点正下方，右边缘不超出屏幕
  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const margin = 8
    const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin)
    setPos({ top: rect.bottom + 8, left })
  }, [open, anchorRef, width])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // 滚动/缩放时直接关闭，避免浮层错位
    const onScroll = () => onClose()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className="card animate-pop fixed z-[90] p-2"
      style={{
        width,
        top: pos?.top ?? -9999,
        left: pos?.left ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
