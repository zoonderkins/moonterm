import { useState, useCallback, useEffect, useRef } from 'react'
import type { TerminalInstance } from '../types'
import { TerminalThumbnail } from './TerminalThumbnail'

interface ThumbnailBarProps {
  terminals: TerminalInstance[]
  allTerminals?: TerminalInstance[]  // For calculating shortcut indices
  focusedTerminalId: string | null
  onFocus: (id: string) => void
  onClose?: (id: string) => void
  onAddTerminal?: () => void
  showAddButton: boolean
  showShortcutHints?: boolean
}

export function ThumbnailBar({
  terminals,
  allTerminals = [],
  focusedTerminalId,
  onFocus,
  onClose,
  onAddTerminal,
  showAddButton,
  showShortcutHints = false
}: ThumbnailBarProps) {
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('thumbnailBarHeight')
    return saved ? parseInt(saved, 10) : 120
  })
  const [isResizing, setIsResizing] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Simple label - just "Switch To" for all cases
  const label = terminals.length > 0 ? 'Switch To' : 'Terminals'

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start resize if clicking near the top edge (resize handle area)
    if (barRef.current) {
      const rect = barRef.current.getBoundingClientRect()
      if (e.clientY - rect.top < 8) {
        e.preventDefault()
        setIsResizing(true)
      }
    }
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const viewportHeight = window.innerHeight
      const newHeight = viewportHeight - e.clientY
      const clampedHeight = Math.max(80, Math.min(viewportHeight * 0.5, newHeight))
      setHeight(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      localStorage.setItem('thumbnailBarHeight', height.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, height])

  // Get the shortcut index for a terminal (1-based, max 9)
  const getShortcutIndex = (terminalId: string): number | null => {
    const index = allTerminals.findIndex(t => t.id === terminalId)
    if (index >= 0 && index < 9) {
      return index + 1
    }
    return null
  }

  return (
    <div
      ref={barRef}
      className={`thumbnail-bar ${isResizing ? 'resizing' : ''}`}
      style={{ height }}
      onMouseDown={handleMouseDown}
    >
      <div className="thumbnail-bar-header">
        <span>{label}</span>
        {showShortcutHints && <span className="hint-label">Ctrl+Shift+#</span>}
      </div>
      <div className="thumbnail-list">
        {terminals.map(terminal => {
          const shortcutIndex = showShortcutHints ? getShortcutIndex(terminal.id) : null
          return (
            <TerminalThumbnail
              key={terminal.id}
              terminal={terminal}
              isActive={terminal.id === focusedTerminalId}
              onClick={() => onFocus(terminal.id)}
              onClose={onClose ? () => onClose(terminal.id) : undefined}
              shortcutHint={shortcutIndex}
            />
          )
        })}
        {showAddButton && onAddTerminal && (
          <button className="add-terminal-btn" onClick={onAddTerminal}>
            +
          </button>
        )}
      </div>
    </div>
  )
}
