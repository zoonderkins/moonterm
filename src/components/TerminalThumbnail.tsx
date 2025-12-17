import { useEffect, useState, useRef } from 'react'
import type { TerminalInstance } from '../types'
import { tauriAPI } from '../lib/tauri-bridge'
import { workspaceStore } from '../stores/workspace-store'

// Global preview cache - persists across component unmounts
const previewCache = new Map<string, string>()
// Listeners waiting for updates
const previewListeners = new Set<() => void>()

// Global listener setup - only once
let globalListenerSetup = false

const setupGlobalListener = async () => {
  if (globalListenerSetup) return
  globalListenerSetup = true

  await tauriAPI.pty.onOutput((id, data) => {
    const prev = previewCache.get(id) || ''
    const combined = prev + data
    // Keep last 8 lines, clean ANSI codes for readability
    const cleaned = combined.replace(/\x1b\[[0-9;]*m/g, '')
    const lines = cleaned.split('\n').slice(-8)
    previewCache.set(id, lines.join('\n'))

    // Notify all listeners immediately
    previewListeners.forEach(listener => listener())
  })
}

interface TerminalThumbnailProps {
  terminal: TerminalInstance
  isActive: boolean
  onClick: () => void
  onClose?: () => void
  shortcutHint?: number | null
}

export function TerminalThumbnail({ terminal, isActive, onClick, onClose, shortcutHint }: TerminalThumbnailProps) {
  const [preview, setPreview] = useState<string>(previewCache.get(terminal.id) || '')
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(terminal.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setupGlobalListener()

    // Update preview when cache changes
    const updatePreview = () => {
      const cached = previewCache.get(terminal.id) || ''
      setPreview(cached)
    }

    // Register listener for immediate updates
    previewListeners.add(updatePreview)

    // Also poll as backup (every 1s)
    const interval = setInterval(updatePreview, 1000)

    // Initial load
    updatePreview()

    return () => {
      previewListeners.delete(updatePreview)
      clearInterval(interval)
    }
  }, [terminal.id])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(terminal.title)
    setIsEditing(true)
  }

  const handleRename = () => {
    const newTitle = editValue.trim()
    if (newTitle && newTitle !== terminal.title) {
      workspaceStore.renameTerminal(terminal.id, newTitle)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditValue(terminal.title)
      setIsEditing(false)
    }
  }

  return (
    <div
      className={`thumbnail ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      {shortcutHint && (
        <span className="shortcut-hint">{shortcutHint}</span>
      )}
      <div className="thumbnail-header" onDoubleClick={handleDoubleClick}>
        <div className="thumbnail-title">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span>{terminal.title}</span>
          )}
        </div>
        {onClose && (
          <button
            className="thumbnail-close-btn"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            title="Close terminal"
          >
            ×
          </button>
        )}
      </div>
      <div className="thumbnail-preview">
        {preview || '$ _'}
      </div>
    </div>
  )
}
