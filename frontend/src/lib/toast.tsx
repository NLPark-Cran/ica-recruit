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
  info: 'bg-grape text-white',
  success: 'bg-mint text-grape-dark',
  error: 'bg-tangerine text-white',
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
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 safe-top">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-pop max-w-sm rounded-2xl px-5 py-3 text-sm font-bold shadow-card ${TYPE_CLASS[t.type]}`}
            role="status"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
