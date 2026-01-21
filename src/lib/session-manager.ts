import type { SessionData, SessionWorkspace, SessionTerminal } from '../types/session'
import { workspaceStore } from '../stores/workspace-store'
import { getAllTerminalContents } from './terminal-registry'
import { getSavedTheme } from '../components/SettingsDialog'
import { APP_VERSION, STORAGE_SCHEMA } from './version'

/**
 * Export current session state to JSON
 */
export function exportSession(): SessionData {
  const state = workspaceStore.getState()
  const terminalContents = getAllTerminalContents()
  const splitRatio = parseFloat(localStorage.getItem('split-ratio') || '0.5')

  const workspaces: SessionWorkspace[] = state.workspaces.map(workspace => {
    const workspaceTerminals = state.terminals.filter(t => t.workspaceId === workspace.id)

    const terminals: SessionTerminal[] = workspaceTerminals.map(t => ({
      id: t.id,
      title: t.title,
      cwd: t.cwd,
      scrollbackContent: terminalContents.get(t.id) || undefined,
    }))

    // Find the focused terminal for this workspace
    const focusedInWorkspace = workspaceTerminals.find(t => t.id === state.focusedTerminalId)

    return {
      id: workspace.id,
      name: workspace.name,
      folderPath: workspace.folderPath,
      terminals,
      focusedTerminalId: focusedInWorkspace?.id,
    }
  })

  return {
    version: STORAGE_SCHEMA.SESSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    theme: getSavedTheme(),
    splitRatio,
    workspaces,
    activeWorkspaceId: state.activeWorkspaceId || undefined,
  }
}

/**
 * Export session to a downloadable JSON file
 */
export function downloadSessionFile(): void {
  const session = exportSession()
  const json = JSON.stringify(session, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `moonterm-session-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Validate session data structure
 */
export function validateSession(data: unknown): data is SessionData {
  if (!data || typeof data !== 'object') return false

  const session = data as Record<string, unknown>

  if (session.version !== '1.0') return false
  if (typeof session.exportedAt !== 'string') return false
  if (!Array.isArray(session.workspaces)) return false

  // Basic validation of workspaces
  for (const ws of session.workspaces) {
    if (!ws || typeof ws !== 'object') return false
    const workspace = ws as Record<string, unknown>
    if (typeof workspace.id !== 'string') return false
    if (typeof workspace.name !== 'string') return false
    if (typeof workspace.folderPath !== 'string') return false
    if (!Array.isArray(workspace.terminals)) return false
  }

  return true
}

/**
 * Import session from JSON data
 * Restores workspaces, terminals, and scrollback content
 */
export async function importSession(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!validateSession(data)) {
      return { success: false, message: 'Invalid session file format' }
    }

    // Apply theme
    if (data.theme) {
      localStorage.setItem('app-theme', data.theme)
    }

    // Apply split ratio
    if (data.splitRatio) {
      localStorage.setItem('split-ratio', data.splitRatio.toString())
    }

    // Import workspaces with terminals and scrollback content
    let workspacesImported = 0
    let terminalsImported = 0

    for (const sessionWorkspace of data.workspaces) {
      // Check if workspace with same folder already exists
      const existingWorkspace = workspaceStore.getState().workspaces.find(
        w => w.folderPath === sessionWorkspace.folderPath
      )

      if (existingWorkspace) {
        // Skip existing workspace
        continue
      }

      // Create workspace
      const workspace = workspaceStore.addWorkspace(sessionWorkspace.name, sessionWorkspace.folderPath)
      workspacesImported++

      // Create terminals for this workspace with scrollback content
      for (const sessionTerminal of sessionWorkspace.terminals) {
        workspaceStore.importTerminal(workspace.id, {
          title: sessionTerminal.title,
          cwd: sessionTerminal.cwd,
          savedScrollbackContent: sessionTerminal.scrollbackContent
        })
        terminalsImported++
      }
    }

    // Set active workspace if specified
    if (data.activeWorkspaceId) {
      const activeWs = workspaceStore.getState().workspaces.find(
        w => data.workspaces.some((sw: SessionWorkspace) => sw.id === data.activeWorkspaceId && sw.folderPath === w.folderPath)
      )
      if (activeWs) {
        workspaceStore.setActiveWorkspace(activeWs.id)
      }
    }

    // Save the imported state
    await workspaceStore.save()

    if (workspacesImported === 0) {
      return {
        success: true,
        message: 'All workspaces already exist. No new data imported.'
      }
    }

    return {
      success: true,
      message: `Imported ${workspacesImported} workspace(s) with ${terminalsImported} terminal(s). Scrollback content restored.`
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof SyntaxError
        ? 'Invalid JSON file'
        : 'Failed to import session'
    }
  }
}
