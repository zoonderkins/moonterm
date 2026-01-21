/**
 * Simple event bus for toast notifications
 * Used to bridge non-React code (like workspace-store) with React components
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastEvent {
  message: string
  variant: ToastVariant
}

type ToastListener = (event: ToastEvent) => void

class ToastEventBus {
  private listeners: Set<ToastListener> = new Set()

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(message: string, variant: ToastVariant = 'info'): void {
    const event: ToastEvent = { message, variant }
    this.listeners.forEach(listener => listener(event))
  }

  success(message: string): void {
    this.emit(message, 'success')
  }

  error(message: string): void {
    this.emit(message, 'error')
  }

  warning(message: string): void {
    this.emit(message, 'warning')
  }

  info(message: string): void {
    this.emit(message, 'info')
  }
}

// Singleton instance
export const toastEvents = new ToastEventBus()
