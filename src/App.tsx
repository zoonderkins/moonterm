import { useEffect, useState, useCallback, useMemo } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { workspaceStore } from './stores/workspace-store'
import { Sidebar } from './components/Sidebar'
import { WorkspaceView } from './components/WorkspaceView'
import { SettingsDialog, applyTheme, getSavedTheme, type ThemeKey } from './components/SettingsDialog'
import { CloseConfirmDialog } from './components/CloseConfirmDialog'
import { initPtyListeners } from './lib/pty-listeners'
import type { AppState } from './types'
import { tauriAPI } from './lib/tauri-bridge'

// Initialize PTY listeners once at app startup
initPtyListeners()

export default function App() {
  const [state, setState] = useState<AppState>(workspaceStore.getState())
  const [showShortcutHints, setShowShortcutHints] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('default')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // Apply saved theme on startup
  useEffect(() => {
    const savedTheme = getSavedTheme()
    setCurrentTheme(savedTheme)
    applyTheme(savedTheme)
  }, [])

  // Listen for window close request (Cmd+Q, clicking X button)
  useEffect(() => {
    const appWindow = getCurrentWindow()
    let unlistenFn: (() => void) | null = null

    appWindow.onCloseRequested(async (event) => {
      // Prevent immediate close
      event.preventDefault()
      // Show confirmation dialog
      setShowCloseConfirm(true)
    }).then(fn => {
      unlistenFn = fn
    })

    return () => {
      if (unlistenFn) unlistenFn()
    }
  }, [])

  // Handle close confirmation
  const handleCloseConfirm = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.destroy()
  }, [])

  const handleCloseCancel = useCallback(() => {
    setShowCloseConfirm(false)
  }, [])

  useEffect(() => {
    const unsubscribe = workspaceStore.subscribe(() => {
      setState(workspaceStore.getState())
    })

    // Load saved workspaces on startup
    workspaceStore.load()

    return unsubscribe
  }, [])

  // Auto-save on exit and periodically
  useEffect(() => {
    // Save before window closes
    const handleBeforeUnload = () => {
      workspaceStore.save()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Also save periodically (every 30 seconds) to avoid data loss
    const saveInterval = setInterval(() => {
      if (state.terminals.length > 0) {
        workspaceStore.save()
      }
    }, 30000)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearInterval(saveInterval)
    }
  }, [state.terminals.length])

  const handleAddWorkspace = useCallback(async () => {
    const folderPath = await tauriAPI.dialog.selectFolder()
    if (folderPath) {
      const name = folderPath.split(/[/\\]/).pop() || 'Workspace'
      workspaceStore.addWorkspace(name, folderPath)
      workspaceStore.save()
    }
  }, [])

  const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId)

  // Get terminals for active workspace (memoized for keyboard shortcuts)
  const activeWorkspaceTerminals = useMemo(() => {
    if (!activeWorkspace) return []
    return workspaceStore.getWorkspaceTerminals(activeWorkspace.id)
  }, [activeWorkspace, state.terminals])

  // Add new terminal to current workspace
  const handleAddTerminal = useCallback(() => {
    if (!activeWorkspace) return
    // Just add terminal to store, PTY will be created by TerminalPanel
    workspaceStore.addTerminal(activeWorkspace.id)
  }, [activeWorkspace])

  // Split the current terminal (toggle mode)
  const handleSplitTerminal = useCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => {
    const focusedId = state.focusedTerminalId
    if (!focusedId || !activeWorkspace) return

    // If already split
    if (state.splitTerminalId) {
      // Same direction → toggle off (close split)
      if (state.splitDirection === direction) {
        workspaceStore.closeSplit()
      }
      // Different direction → do nothing (keep the existing split)
      return
    }

    // No split → create new split (PTY will be created by TerminalPanel)
    workspaceStore.splitTerminal(focusedId, direction)
  }, [state.focusedTerminalId, state.splitTerminalId, state.splitDirection, activeWorkspace])

  // Close current terminal tab
  const handleCloseTerminal = useCallback(() => {
    const focusedId = state.focusedTerminalId
    if (!focusedId) return

    // If this terminal has a split, close the split first
    const splitTerminal = workspaceStore.getSplitTerminal()
    if (splitTerminal?.splitFromId === focusedId) {
      workspaceStore.closeSplit()
    }

    tauriAPI.pty.kill(focusedId)
    workspaceStore.removeTerminal(focusedId)
  }, [state.focusedTerminalId])

  // Keyboard shortcuts: Ctrl+1~9 for workspace, Cmd+1~9 for terminals, Cmd+T/W/D for tab operations
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    const handleKeyDown = (e: KeyboardEvent) => {
      // Let Tab key through to terminal for auto-complete
      if (e.key === 'Tab') {
        return // Don't intercept Tab
      }

      // Show hints when Ctrl or Cmd is pressed (but not with other modifiers for hints)
      if (e.key === 'Control' || e.key === 'Meta') {
        setShowShortcutHints(true)
        return
      }

      // On Mac: Use Cmd for tab operations, Ctrl goes to terminal (e.g., Ctrl+C, Ctrl+W)
      // On Windows/Linux: Use Ctrl for tab operations
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Cmd+T (Mac) or Ctrl+T (Windows/Linux): New terminal tab
      if (modKey && e.key === 't') {
        e.preventDefault()
        e.stopPropagation()
        handleAddTerminal()
        return
      }

      // Cmd+W (Mac) or Ctrl+W (Windows/Linux): Close current terminal tab
      if (modKey && e.key === 'w') {
        e.preventDefault()
        e.stopPropagation()
        handleCloseTerminal()
        return
      }

      // Cmd+D (Mac) or Ctrl+D (Windows/Linux): Split terminal
      // With Shift: vertical (left/right), without: horizontal (top/bottom)
      if (modKey && e.key === 'd') {
        e.preventDefault()
        e.stopPropagation()
        handleSplitTerminal(e.shiftKey ? 'vertical' : 'horizontal')
        return
      }

      // Cmd+Arrow keys: Switch split pane focus
      if (modKey && state.splitTerminalId) {
        const dir = state.splitDirection
        // For vertical split (left/right): use Left/Right arrows
        // For horizontal split (top/bottom): use Up/Down arrows
        if (dir === 'vertical' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault()
          e.stopPropagation()
          workspaceStore.setFocusedPane(e.key === 'ArrowLeft' ? 'main' : 'split')
          return
        }
        if (dir === 'horizontal' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault()
          e.stopPropagation()
          workspaceStore.setFocusedPane(e.key === 'ArrowUp' ? 'main' : 'split')
          return
        }
      }

      // Cmd+1~9: Switch terminal tab (Mac style)
      if (e.metaKey && !e.ctrlKey) {
        const num = parseInt(e.key, 10)
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault()
          e.stopPropagation()
          const terminals = activeWorkspaceTerminals
          const index = num - 1
          if (index < terminals.length) {
            workspaceStore.setFocusedTerminal(terminals[index].id)
          }
          return
        }
      }

      // Ctrl+1~9: Switch workspace (only intercept number keys, not other Ctrl combos)
      if (e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10)
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault()
          e.stopPropagation()
          const index = num - 1
          if (index < state.workspaces.length) {
            workspaceStore.setActiveWorkspace(state.workspaces[index].id)
          }
          return
        }
        // Let other Ctrl+key combinations through to terminal (Ctrl+C, Ctrl+W, etc.)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setShowShortcutHints(false)
      }
    }

    // Also hide hints if window loses focus
    const handleBlur = () => setShowShortcutHints(false)

    // Use capture phase to intercept events before xterm.js handles them
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [state.workspaces, state.splitTerminalId, state.splitDirection, activeWorkspaceTerminals, handleAddTerminal, handleSplitTerminal, handleCloseTerminal])

  const handleThemeChange = useCallback((theme: ThemeKey) => {
    setCurrentTheme(theme)
    applyTheme(theme)
  }, [])

  return (
    <div className="app">
      <Sidebar
        workspaces={state.workspaces}
        activeWorkspaceId={state.activeWorkspaceId}
        onSelectWorkspace={(id) => workspaceStore.setActiveWorkspace(id)}
        onAddWorkspace={handleAddWorkspace}
        onRemoveWorkspace={(id) => {
          workspaceStore.removeWorkspace(id)
          workspaceStore.save()
        }}
        onSettingsClick={() => setShowSettings(true)}
        showShortcutHints={showShortcutHints}
      />
      <main className="main-content">
        {state.workspaces.length > 0 ? (
          // Render ALL workspaces to keep terminals mounted and preserve content
          // Only the active workspace is visible, others are hidden with CSS
          state.workspaces.map(workspace => (
            <div
              key={workspace.id}
              className={`workspace-container ${workspace.id === state.activeWorkspaceId ? 'active' : 'hidden'}`}
            >
              <WorkspaceView
                workspace={workspace}
                terminals={workspaceStore.getWorkspaceTerminals(workspace.id)}
                focusedTerminalId={state.focusedTerminalId}
                splitTerminalId={state.splitTerminalId}
                splitDirection={state.splitDirection}
                focusedPane={state.focusedPane}
                showShortcutHints={showShortcutHints && workspace.id === state.activeWorkspaceId}
              />
            </div>
          ))
        ) : (
          <div className="empty-state">
            <h2>Welcome to Moonterm</h2>
            <p>Click "+ Add Workspace" to get started</p>
          </div>
        )}
      </main>

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
      />

      {showCloseConfirm && (
        <CloseConfirmDialog
          onConfirm={handleCloseConfirm}
          onCancel={handleCloseCancel}
        />
      )}
    </div>
  )
}
