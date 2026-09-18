import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastType = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  text: string
  type: ToastType
}

interface ToastContextValue {
  toast: (text: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const TYPE_CLASS: Record<ToastType, string> = {
  info: 'bg-sky text-ink',
  success: 'bg-leaf text-white',
  error: 'bg-blush text-ink',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const toast = useCallback((text: string, type: ToastType = 'info') => {
    const id = ++seq.current
    setItems((prev) => [...prev.slice(-3), { id, text, type }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="safe-top pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-pop max-w-sm rounded-2xl border-[3px] border-ink px-5 py-3 text-sm font-black shadow-sticker ${TYPE_CLASS[t.type]}`}
            role="status"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
