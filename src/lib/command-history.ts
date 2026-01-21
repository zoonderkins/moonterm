/**
 * Command History Manager
 * Stores command history per workspace in localStorage
 */

export interface CommandHistoryEntry {
  command: string
  timestamp: number
  workspaceId: string
}

const STORAGE_KEY_PREFIX = 'command-history-'
const MAX_HISTORY_SIZE = 100

/**
 * Get storage key for a workspace
 */
function getStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`
}

/**
 * Load command history for a workspace from localStorage
 */
export function loadHistory(workspaceId: string): CommandHistoryEntry[] {
  try {
    const data = localStorage.getItem(getStorageKey(workspaceId))
    if (!data) return []
    return JSON.parse(data) as CommandHistoryEntry[]
  } catch {
    return []
  }
}

/**
 * Save command history for a workspace to localStorage
 */
export function saveHistory(workspaceId: string, history: CommandHistoryEntry[]): void {
  try {
    // Keep only the most recent entries
    const trimmed = history.slice(-MAX_HISTORY_SIZE)
    localStorage.setItem(getStorageKey(workspaceId), JSON.stringify(trimmed))
  } catch (error) {
    console.error('[CommandHistory] Failed to save:', error)
  }
}

/**
 * Add a command to history for a workspace
 * Deduplicates consecutive identical commands
 */
export function addCommand(workspaceId: string, command: string): void {
  const trimmedCommand = command.trim()
  if (!trimmedCommand) return

  const history = loadHistory(workspaceId)

  // Skip if same as the last command (avoid consecutive duplicates)
  if (history.length > 0 && history[history.length - 1].command === trimmedCommand) {
    return
  }

  const entry: CommandHistoryEntry = {
    command: trimmedCommand,
    timestamp: Date.now(),
    workspaceId
  }

  history.push(entry)
  saveHistory(workspaceId, history)
}

/**
 * Get unique commands from history (most recent first, deduplicated)
 */
export function getUniqueCommands(workspaceId: string): string[] {
  const history = loadHistory(workspaceId)
  const seen = new Set<string>()
  const unique: string[] = []

  // Traverse from newest to oldest
  for (let i = history.length - 1; i >= 0; i--) {
    const cmd = history[i].command
    if (!seen.has(cmd)) {
      seen.add(cmd)
      unique.push(cmd)
    }
  }

  return unique
}

/**
 * Search history with fuzzy matching
 * Returns commands that contain the query (case-insensitive)
 */
export function searchHistory(workspaceId: string, query: string): string[] {
  const commands = getUniqueCommands(workspaceId)
  if (!query.trim()) return commands

  const lowerQuery = query.toLowerCase()
  return commands.filter(cmd => cmd.toLowerCase().includes(lowerQuery))
}

/**
 * Clear history for a workspace
 */
export function clearHistory(workspaceId: string): void {
  localStorage.removeItem(getStorageKey(workspaceId))
}

/**
 * Delete history for removed workspaces
 */
export function cleanupOrphanedHistory(validWorkspaceIds: string[]): void {
  const validSet = new Set(validWorkspaceIds)
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      const workspaceId = key.slice(STORAGE_KEY_PREFIX.length)
      if (!validSet.has(workspaceId)) {
        keysToRemove.push(key)
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/**
 * Command input buffer for capturing commands from terminal
 * Used to collect characters until Enter is pressed
 */
export class CommandInputBuffer {
  private buffer = ''
  private workspaceId: string
  private enabled = true

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  /**
   * Process input data from terminal
   * Returns the command if Enter was pressed, null otherwise
   */
  processInput(data: string): string | null {
    if (!this.enabled) return null

    for (const char of data) {
      const code = char.charCodeAt(0)

      // Enter key (CR or LF)
      if (code === 13 || code === 10) {
        const command = this.buffer.trim()
        this.buffer = ''
        if (command) {
          addCommand(this.workspaceId, command)
          return command
        }
        return null
      }

      // Backspace (DEL or BS)
      if (code === 127 || code === 8) {
        this.buffer = this.buffer.slice(0, -1)
        continue
      }

      // Ctrl+C or Ctrl+D - clear buffer
      if (code === 3 || code === 4) {
        this.buffer = ''
        continue
      }

      // Ctrl+U - clear line
      if (code === 21) {
        this.buffer = ''
        continue
      }

      // Ignore other control characters
      if (code < 32) {
        continue
      }

      // Regular character - add to buffer
      this.buffer += char
    }

    return null
  }

  /**
   * Clear the input buffer
   */
  clear(): void {
    this.buffer = ''
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer
  }

  /**
   * Enable/disable command capture
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.buffer = ''
    }
  }
}
