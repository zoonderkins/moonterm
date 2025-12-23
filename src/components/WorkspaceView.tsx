import { useEffect, useCallback, useState, useRef, memo } from 'react'
import type { Workspace, TerminalInstance, SplitDirection, FocusedPane } from '../types'
import { workspaceStore } from '../stores/workspace-store'
import { TerminalPanel } from './TerminalPanel'
import { TabBar } from './TabBar'
import { tauriAPI } from '../lib/tauri-bridge'

interface WorkspaceViewProps {
  workspace: Workspace
  terminals: TerminalInstance[]
  focusedTerminalId: string | null
  splitTerminalId: string | null
  splitDirection: SplitDirection | null
  focusedPane: FocusedPane
  showShortcutHints?: boolean
  onUnlockRequest?: (workspaceId: string) => void
}

// Memoized component to prevent unnecessary re-renders when other workspaces change
export const WorkspaceView = memo(function WorkspaceView({
  workspace,
  terminals,
  focusedTerminalId,
  splitTerminalId: _splitTerminalId,  // Used to trigger re-render when split changes
  splitDirection,
  focusedPane,
  showShortcutHints = false,
  onUnlockRequest
}: WorkspaceViewProps) {
  const focusedTerminal = terminals.find(t => t.id === focusedTerminalId)
  const splitTerminal = workspaceStore.getSplitTerminal()
  void _splitTerminalId  // Acknowledge the prop is intentionally used for reactivity

  // Persist split ratio to localStorage
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('split-ratio')
    return saved ? parseFloat(saved) : 0.5
  })
  const [isResizing, setIsResizing] = useState(false)
  const isVertical = splitDirection === 'vertical'

  // Track terminals with new activity (for tab indicator)
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(new Set())

  // Clear activity indicator when a terminal becomes focused
  useEffect(() => {
    if (focusedTerminalId && activeTerminalIds.has(focusedTerminalId)) {
      setActiveTerminalIds(prev => {
        const next = new Set(prev)
        next.delete(focusedTerminalId)
        return next
      })
    }
  }, [focusedTerminalId, activeTerminalIds])

  // Handle activity notification from terminal
  const handleTerminalActivity = useCallback((terminalId: string) => {
    // Only add to activity set if this terminal is not currently focused
    if (terminalId !== focusedTerminalId) {
      setActiveTerminalIds(prev => {
        if (prev.has(terminalId)) return prev
        const next = new Set(prev)
        next.add(terminalId)
        return next
      })
    }
  }, [focusedTerminalId])

  // Handle tab reorder
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    workspaceStore.reorderTerminals(workspace.id, fromIndex, toIndex)
  }, [workspace.id])

  // Save split ratio when it changes
  useEffect(() => {
    localStorage.setItem('split-ratio', splitRatio.toString())
  }, [splitRatio])

  // Track if we've ever had terminals (to avoid auto-creating after user closes all)
  const hadTerminalsRef = useRef(terminals.length > 0)

  // Update ref when terminals change
  useEffect(() => {
    if (terminals.length > 0) {
      hadTerminalsRef.current = true
    }
  }, [terminals.length])

  // Auto-create first terminal only for new workspaces that never had terminals
  // Skip for locked workspaces (terminals will be restored on unlock)
  useEffect(() => {
    if (terminals.length === 0 && !hadTerminalsRef.current && !workspace.isLocked) {
      // Just add terminal to store, PTY will be created by TerminalPanel
      workspaceStore.addTerminal(workspace.id)
    }
  }, [workspace.id, terminals.length, workspace.folderPath, workspace.isLocked])

  // Set default focus to first terminal
  useEffect(() => {
    if (!focusedTerminalId && terminals.length > 0) {
      workspaceStore.setFocusedTerminal(terminals[0].id)
    }
  }, [focusedTerminalId, terminals])

  const handleAddTerminal = useCallback(() => {
    // Just add terminal to store, PTY will be created by TerminalPanel
    workspaceStore.addTerminal(workspace.id)
  }, [workspace.id])

  const handleCloseTerminal = useCallback((id: string) => {
    // If closing the main terminal that has a split, also close the split
    if (splitTerminal?.splitFromId === id) {
      workspaceStore.closeSplit()
    }
    tauriAPI.pty.kill(id)
    workspaceStore.removeTerminal(id)
    // Save immediately to persist the closed tab state
    workspaceStore.save()
  }, [splitTerminal])

  const handleFocus = useCallback((id: string) => {
    workspaceStore.setFocusedTerminal(id)
  }, [])

  const mainTerminal = focusedTerminal || terminals[0]
  const isSplit = splitTerminal && splitTerminal.splitFromId === mainTerminal?.id

  // Handle split resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.terminals-container')
      if (!container) return

      const rect = container.getBoundingClientRect()
      // Calculate ratio based on split direction
      const ratio = isVertical
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, isVertical])

  return (
    <div className="workspace-view">
      {/* Locked workspace overlay */}
      {workspace.isLocked && (
        <div className="workspace-locked-overlay">
          <span className="lock-icon-large">🔒</span>
          <p>This workspace is locked</p>
          <button onClick={() => onUnlockRequest?.(workspace.id)}>
            Unlock Workspace
          </button>
        </div>
      )}

      {/* Tab Bar at top - browser style */}
      {!workspace.isLocked && (
        <TabBar
          terminals={terminals}
          focusedTerminalId={focusedTerminalId}
          activeTerminalIds={activeTerminalIds}
          onFocus={handleFocus}
          onClose={handleCloseTerminal}
          onAddTerminal={handleAddTerminal}
          onReorder={handleReorder}
          showShortcutHints={showShortcutHints}
        />
      )}

      {/* Terminal content area */}
      {!workspace.isLocked && (terminals.length === 0 ? (
        <div className="terminals-empty-state">
          <p>No terminals open</p>
          <button onClick={handleAddTerminal} className="add-terminal-btn-large">
            + New Terminal
          </button>
          <p className="hint">or press Cmd+T</p>
        </div>
      ) : (
        <div className={`terminals-container ${isSplit ? (isVertical ? 'split-vertical' : 'split-horizontal') : ''}`}>
          {/* Main pane - all terminals rendered, only focused visible */}
          <div
            className={`terminal-pane main-pane ${focusedPane === 'main' ? 'pane-focused' : ''}`}
            style={isSplit
              ? (isVertical ? { width: `${splitRatio * 100}%` } : { height: `${splitRatio * 100}%` })
              : undefined
            }
            onClick={() => workspaceStore.setFocusedPane('main')}
          >
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                className={`terminal-wrapper ${terminal.id === mainTerminal?.id ? 'active' : 'hidden'}`}
              >
                <TerminalPanel
                  terminalId={terminal.id}
                  isActive={terminal.id === mainTerminal?.id && focusedPane === 'main'}
                  cwd={terminal.cwd}
                  savedScrollbackContent={terminal.savedScrollbackContent}
                  onActivity={() => handleTerminalActivity(terminal.id)}
                />
              </div>
            ))}
          </div>

          {isSplit && splitTerminal && (
            <>
              <div
                className={`split-divider ${isVertical ? 'vertical' : 'horizontal'} ${isResizing ? 'resizing' : ''}`}
                onMouseDown={handleResizeStart}
              >
                <div className="split-divider-handle" />
              </div>
              <div
                className={`terminal-pane split-pane ${focusedPane === 'split' ? 'pane-focused' : ''}`}
                style={isVertical
                  ? { width: `${(1 - splitRatio) * 100}%` }
                  : { height: `${(1 - splitRatio) * 100}%` }
                }
                onClick={() => workspaceStore.setFocusedPane('split')}
              >
                <TerminalPanel
                  terminalId={splitTerminal.id}
                  isActive={focusedPane === 'split'}
                  cwd={splitTerminal.cwd}
                  onActivity={() => handleTerminalActivity(splitTerminal.id)}
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
})
