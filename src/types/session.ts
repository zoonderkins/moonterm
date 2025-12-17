/**
 * Moonterm Session Schema v1.0
 *
 * Used for exporting/importing terminal session state
 */

export interface SessionTerminal {
  id: string
  title: string
  cwd: string
  // Serialized terminal content (xterm.js serialize addon format)
  scrollbackContent?: string
  // Cursor position when saved
  cursorPosition?: {
    x: number
    y: number
  }
}

export interface SessionWorkspace {
  id: string
  name: string
  folderPath: string
  terminals: SessionTerminal[]
  // Which terminal was focused
  focusedTerminalId?: string
}

export interface SessionData {
  // Schema version for future compatibility
  version: '1.0'
  // Export timestamp
  exportedAt: string
  // App version
  appVersion: string
  // Theme setting
  theme: string
  // Split ratio setting
  splitRatio: number
  // All workspaces with their terminals
  workspaces: SessionWorkspace[]
  // Which workspace was active
  activeWorkspaceId?: string
}

/**
 * Example JSON structure:
 * {
 *   "version": "1.0",
 *   "exportedAt": "2024-01-15T10:30:00.000Z",
 *   "appVersion": "1.0.0",
 *   "theme": "default",
 *   "splitRatio": 0.5,
 *   "workspaces": [
 *     {
 *       "id": "uuid-1",
 *       "name": "my-project",
 *       "folderPath": "/Users/user/projects/my-project",
 *       "terminals": [
 *         {
 *           "id": "term-1",
 *           "title": "Terminal 1",
 *           "cwd": "/Users/user/projects/my-project",
 *           "scrollbackContent": "$ npm run dev\n> vite..."
 *         }
 *       ],
 *       "focusedTerminalId": "term-1"
 *     }
 *   ],
 *   "activeWorkspaceId": "uuid-1"
 * }
 */
