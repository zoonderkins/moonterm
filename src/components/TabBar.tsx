import { useState, useCallback, useRef, useEffect } from 'react'
import type { TerminalInstance } from '../types'
import { workspaceStore } from '../stores/workspace-store'
import { EnvPopover } from './EnvPopover'

interface TabBarProps {
  terminals: TerminalInstance[]
  focusedTerminalId: string | null
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onAddTerminal: () => void
  showShortcutHints?: boolean
}

interface TabProps {
  terminal: TerminalInstance
  isActive: boolean
  index: number
  onClick: () => void
  onClose: () => void
  showShortcutHint?: boolean
  onShowEnv: (e: React.MouseEvent) => void
}

function Tab({ terminal, isActive, index, onClick, onClose, showShortcutHint, onShowEnv }: TabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showTooltip, setShowTooltip] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const tooltipTimeoutRef = useRef<number | undefined>(undefined)

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(terminal.title)
    setIsEditing(true)
  }, [terminal.title])

  const handleRename = useCallback(() => {
    if (editValue.trim()) {
      workspaceStore.renameTerminal(terminal.id, editValue.trim())
    }
    setIsEditing(false)
  }, [terminal.id, editValue])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }, [handleRename])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleMouseEnter = useCallback(() => {
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(true)
    }, 500)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    setShowTooltip(false)
  }, [])

  // Get last few lines from scrollback for preview
  const previewLines = terminal.scrollbackBuffer.slice(-5).join('').slice(-200)

  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showShortcutHint && index < 9 && (
        <span className="tab-shortcut-hint">{index + 1}</span>
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="tab-rename-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="tab-title">{terminal.title}</span>
      )}

      <button
        className="tab-env-btn"
        onClick={(e) => {
          e.stopPropagation()
          onShowEnv(e)
        }}
        title="Environment Variables"
      >
        ENV
      </button>

      <button
        className="tab-close-btn"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        title="Close tab"
      >
        ×
      </button>

      {showTooltip && previewLines && (
        <div className="tab-tooltip">
          <pre>{previewLines}</pre>
        </div>
      )}
    </div>
  )
}

export function TabBar({
  terminals,
  focusedTerminalId,
  onFocus,
  onClose,
  onAddTerminal,
  showShortcutHints = false
}: TabBarProps) {
  const [envPopover, setEnvPopover] = useState<{
    terminalId: string
    workspaceId: string
    position: { x: number; y: number }
  } | null>(null)

  const handleShowEnv = (terminal: TerminalInstance, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setEnvPopover({
      terminalId: terminal.id,
      workspaceId: terminal.workspaceId,
      position: { x: rect.left, y: rect.bottom + 5 },
    })
  }

  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {terminals.map((terminal, index) => (
          <Tab
            key={terminal.id}
            terminal={terminal}
            isActive={terminal.id === focusedTerminalId}
            index={index}
            onClick={() => onFocus(terminal.id)}
            onClose={() => onClose(terminal.id)}
            showShortcutHint={showShortcutHints}
            onShowEnv={(e) => handleShowEnv(terminal, e)}
          />
        ))}
        <button
          className="add-tab-btn"
          onClick={onAddTerminal}
          title="New Terminal (Cmd+T)"
        >
          +
        </button>
      </div>
      {showShortcutHints && (
        <span className="tab-hint-label">Ctrl+Shift+#</span>
      )}

      {envPopover && (
        <EnvPopover
          workspaceId={envPopover.workspaceId}
          terminalId={envPopover.terminalId}
          position={envPopover.position}
          onClose={() => setEnvPopover(null)}
        />
      )}
    </div>
  )
}
