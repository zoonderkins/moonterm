import { useEffect, useState, useCallback, useMemo } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { workspaceStore } from './stores/workspace-store'
import { Sidebar } from './components/Sidebar'
import { WorkspaceView } from './components/WorkspaceView'
import { SettingsDialog, applyTheme, getSavedTheme, type ThemeKey } from './components/SettingsDialog'
import { CloseConfirmDialog } from './components/CloseConfirmDialog'
import { PasswordDialog } from './components/PasswordDialog'
import { initPtyListeners } from './lib/pty-listeners'
import type { AppState } from './types'
import { tauriAPI } from './lib/tauri-bridge'
import { getAllTerminalContents } from './lib/terminal-registry'

// Initialize PTY listeners once at app startup
initPtyListeners()

export default function App() {
  const [state, setState] = useState<AppState>(workspaceStore.getState())
  const [showShortcutHints, setShowShortcutHints] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('default')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  // Password dialog state
  const [passwordDialog, setPasswordDialog] = useState<{
    mode: 'set' | 'unlock' | 'confirm-delete'
    workspaceId: string
    workspaceName: string
    hint?: string
  } | null>(null)
  const [passwordError, setPasswordError] = useState('')

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

  // Lock workspace handler - uses session password if available, otherwise shows dialog
  const handleLockWorkspace = useCallback(async (workspaceId: string) => {
    const workspace = state.workspaces.find(w => w.id === workspaceId)
    if (!workspace) return

    // Check if we have a session password (from previous unlock in this session)
    const sessionPassword = workspaceStore.getSessionPassword(workspaceId)
    if (sessionPassword) {
      // Quick re-lock with cached password
      try {
        const terminals = workspaceStore.getAllWorkspaceTerminals(workspaceId)
        const terminalContents = getAllTerminalContents()
        const dataToEncrypt = JSON.stringify({
          terminals: terminals.map(t => ({
            id: t.id,
            title: t.title,
            cwd: t.cwd,
            splitFromId: t.splitFromId,
            scrollbackContent: terminalContents.get(t.id)
          })),
          splitTerminalId: state.splitTerminalId,
          splitDirection: state.splitDirection
        })
        const encryptedData = await tauriAPI.crypto.encrypt(dataToEncrypt, sessionPassword, workspace.passwordHint)
        workspaceStore.lockWorkspace(workspaceId, encryptedData, workspace.passwordHint)
        workspaceStore.save()
        return
      } catch {
        // If re-encryption fails, fall through to show password dialog
        workspaceStore.clearSessionPassword(workspaceId)
      }
    }

    // No session password - show dialog to set new password
    setPasswordError('')
    setPasswordDialog({
      mode: 'set',
      workspaceId,
      workspaceName: workspace.name
    })
  }, [state.workspaces])

  // Unlock workspace handler - shows password unlock dialog
  const handleUnlockWorkspace = useCallback((workspaceId: string) => {
    const workspace = state.workspaces.find(w => w.id === workspaceId)
    if (!workspace) return
    setPasswordError('')
    setPasswordDialog({
      mode: 'unlock',
      workspaceId,
      workspaceName: workspace.name,
      hint: workspace.passwordHint
    })
  }, [state.workspaces])

  // Handle password submission
  const handlePasswordSubmit = useCallback(async (password: string, hint?: string) => {
    if (!passwordDialog) return

    try {
      if (passwordDialog.mode === 'set') {
        // Encrypt ALL workspace terminals including splits
        const terminals = workspaceStore.getAllWorkspaceTerminals(passwordDialog.workspaceId)
        const terminalContents = getAllTerminalContents()
        const dataToEncrypt = JSON.stringify({
          terminals: terminals.map(t => ({
            id: t.id,
            title: t.title,
            cwd: t.cwd,
            splitFromId: t.splitFromId,  // Preserve split relationship
            scrollbackContent: terminalContents.get(t.id)
          })),
          // Also save split state
          splitTerminalId: state.splitTerminalId,
          splitDirection: state.splitDirection
        })

        const encryptedData = await tauriAPI.crypto.encrypt(dataToEncrypt, password, hint)
        workspaceStore.lockWorkspace(passwordDialog.workspaceId, encryptedData, hint)
        // Cache password for quick re-lock in this session
        workspaceStore.setSessionPassword(passwordDialog.workspaceId, password)
        workspaceStore.save()
        setPasswordDialog(null)
      } else if (passwordDialog.mode === 'unlock') {
        // Decrypt workspace data
        const workspace = state.workspaces.find(w => w.id === passwordDialog.workspaceId)
        if (!workspace?.encryptedData) return

        // Decrypt and restore terminals
        const decryptedData = await tauriAPI.crypto.decrypt(workspace.encryptedData, password)
        const parsed = JSON.parse(decryptedData)
        // Successfully decrypted - unlock workspace and restore terminals (including splits)
        workspaceStore.unlockWorkspace(passwordDialog.workspaceId, {
          terminals: parsed.terminals,
          splitTerminalId: parsed.splitTerminalId,
          splitDirection: parsed.splitDirection
        })
        // Cache password for quick re-lock in this session
        workspaceStore.setSessionPassword(passwordDialog.workspaceId, password)
        workspaceStore.save()
        setPasswordDialog(null)
      }
    } catch {
      setPasswordError('Incorrect password')
    }
  }, [passwordDialog, state.workspaces])

  // Handle forgot password - show delete confirmation
  const handleForgotPassword = useCallback(() => {
    if (!passwordDialog) return
    setPasswordDialog({
      ...passwordDialog,
      mode: 'confirm-delete'
    })
  }, [passwordDialog])

  // Handle delete locked workspace
  const handleDeleteLockedWorkspace = useCallback(() => {
    if (!passwordDialog) return
    workspaceStore.removeWorkspace(passwordDialog.workspaceId)
    workspaceStore.save()
    setPasswordDialog(null)
  }, [passwordDialog])

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
        onLockWorkspace={handleLockWorkspace}
        onUnlockWorkspace={handleUnlockWorkspace}
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
                onUnlockRequest={handleUnlockWorkspace}
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

      {passwordDialog && (
        <PasswordDialog
          mode={passwordDialog.mode}
          workspaceName={passwordDialog.workspaceName}
          hint={passwordDialog.hint}
          error={passwordError}
          onSubmit={handlePasswordSubmit}
          onCancel={() => setPasswordDialog(null)}
          onDelete={passwordDialog.mode === 'unlock' ? handleForgotPassword : handleDeleteLockedWorkspace}
        />
      )}
    </div>
  )
}
