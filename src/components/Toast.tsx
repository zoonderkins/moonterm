import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { toastEvents } from '../lib/toast-events'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message: string, variant: ToastVariant = 'info', duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const toast: Toast = { id, message, variant, duration }
    setToasts(prev => [...prev, toast])

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  const success = useCallback((message: string) => show(message, 'success'), [show])
  const error = useCallback((message: string) => show(message, 'error', 5000), [show])
  const warning = useCallback((message: string) => show(message, 'warning', 4000), [show])
  const info = useCallback((message: string) => show(message, 'info'), [show])

  // Subscribe to toast events from non-React code (e.g., workspace-store)
  useEffect(() => {
    const unsubscribe = toastEvents.subscribe((event) => {
      show(event.message, event.variant)
    })
    return unsubscribe
  }, [show])

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Start exit animation before removal
    const exitDelay = toast.duration > 0 ? toast.duration - 300 : 0
    if (exitDelay > 0) {
      const timer = setTimeout(() => setIsExiting(true), exitDelay)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  const icons: Record<ToastVariant, string> = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✕'
  }

  return (
    <div
      className={`toast toast-${toast.variant} ${isExiting ? 'toast-exit' : ''}`}
      onClick={() => onRemove(toast.id)}
    >
      <span className="toast-icon">{icons[toast.variant]}</span>
      <span className="toast-message">{toast.message}</span>
    </div>
  )
}
