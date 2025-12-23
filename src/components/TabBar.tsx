import { useState, useCallback, useRef, useEffect } from 'react'
import type { TerminalInstance } from '../types'
import { workspaceStore } from '../stores/workspace-store'
import { EnvPopover } from './EnvPopover'

interface TabBarProps {
  terminals: TerminalInstance[]
  focusedTerminalId: string | null
  activeTerminalIds: Set<string>  // Terminals with recent activity
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onAddTerminal: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
  showShortcutHints?: boolean
}

interface TabProps {
  terminal: TerminalInstance
  isActive: boolean
  hasActivity: boolean  // Has new output while inactive
  index: number
  onClick: () => void
  onClose: () => void
  showShortcutHint?: boolean
  onShowEnv: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
}

function Tab({ terminal, isActive, hasActivity, index, onClick, onClose, showShortcutHint, onShowEnv, onDragStart, onDragOver, onDrop, onDragEnd }: TabProps) {
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
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {showShortcutHint && index < 9 && (
        <span className="tab-shortcut-hint">{index + 1}</span>
      )}

      {hasActivity && !isActive && (
        <span className="tab-activity-dot" title="New output" />
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
  activeTerminalIds,
  onFocus,
  onClose,
  onAddTerminal,
  onReorder,
  showShortcutHints = false
}: TabBarProps) {
  const [envPopover, setEnvPopover] = useState<{
    terminalId: string
    workspaceId: string
    position: { x: number; y: number }
  } | null>(null)

  // Drag state for tab reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleShowEnv = (terminal: TerminalInstance, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setEnvPopover({
      terminalId: terminal.id,
      workspaceId: terminal.workspaceId,
      position: { x: rect.left, y: rect.bottom + 5 },
    })
  }

  // Drag handlers for tab reordering
  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const sourceIndex = draggedIndex
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      onReorder(sourceIndex, targetIndex)
    }
    setDraggedIndex(null)
    // Reset opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }, [draggedIndex, onReorder])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedIndex(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }, [])

  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {terminals.map((terminal, index) => (
          <Tab
            key={terminal.id}
            terminal={terminal}
            isActive={terminal.id === focusedTerminalId}
            hasActivity={activeTerminalIds.has(terminal.id)}
            index={index}
            onClick={() => onFocus(terminal.id)}
            onClose={() => onClose(terminal.id)}
            showShortcutHint={showShortcutHints}
            onShowEnv={(e) => handleShowEnv(terminal, e)}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
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
