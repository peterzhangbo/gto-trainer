import { useState, useEffect } from 'react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  duration?: number
}

// Global toast state via simple pub/sub
let listeners: Array<(toasts: ToastMessage[]) => void> = []
let toasts: ToastMessage[] = []

function notify() {
  for (const listener of listeners) listener([...toasts])
}

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string, type: ToastMessage['type'] = 'info', duration = 4000) {
  const id = crypto.randomUUID()
  const toast: ToastMessage = { id, type, message, duration }
  toasts = [...toasts, toast]
  notify()

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

function useToasts() {
  const [current, setCurrent] = useState<ToastMessage[]>([])

  useEffect(() => {
    listeners.push(setCurrent)
    return () => {
      listeners = listeners.filter((l) => l !== setCurrent)
    }
  }, [])

  return current
}

const typeStyles: Record<ToastMessage['type'], string> = {
  success: 'border-green-500/50 bg-green-900/80 text-green-100',
  error: 'border-red-500/50 bg-red-900/80 text-red-100',
  info: 'border-blue-500/50 bg-blue-900/80 text-blue-100',
}

const typeIcons: Record<ToastMessage['type'], string> = {
  success: '✓',
  error: '✗',
  info: 'i',
}

export default function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl ${typeStyles[toast.type]}`}
        >
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold mt-0.5">
            {typeIcons[toast.type]}
          </span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
