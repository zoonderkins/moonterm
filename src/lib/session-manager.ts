import type { SessionData, SessionWorkspace, SessionTerminal } from '../types/session'
import { workspaceStore } from '../stores/workspace-store'
import { getAllTerminalContents } from './terminal-registry'
import { getSavedTheme } from '../components/SettingsDialog'

const APP_VERSION = '1.0.0'

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
    version: '1.0',
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
 * Note: This only imports workspace/terminal metadata, not scrollback content
 * (scrollback restoration would require PTY support which isn't implemented)
 */
export async function importSession(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!validateSession(data)) {
      return { success: false, message: 'Invalid session file format' }
    }

    // Store the session data for reference
    // Note: We can't fully restore terminals with their content,
    // but we can restore the workspace structure
    localStorage.setItem('imported-session', text)

    // Apply theme
    if (data.theme) {
      localStorage.setItem('app-theme', data.theme)
    }

    // Apply split ratio
    if (data.splitRatio) {
      localStorage.setItem('split-ratio', data.splitRatio.toString())
    }

    return {
      success: true,
      message: `Session exported on ${new Date(data.exportedAt).toLocaleDateString()} imported. Theme and settings applied. Reload to see changes.`
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
