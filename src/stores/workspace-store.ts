import { v4 as uuidv4 } from 'uuid'
import type { Workspace, TerminalInstance, AppState, SplitDirection, FocusedPane } from '../types'
import { tauriAPI } from '../lib/tauri-bridge'
import { getAllTerminalContents } from '../lib/terminal-registry'
import { STORAGE_SCHEMA } from '../lib/version'
import { toastEvents } from '../lib/toast-events'

// Activity threshold: terminal is "active" if last activity was within this time
export const ACTIVITY_THRESHOLD_MS = 10_000 // 10 seconds

// Maximum scrollback buffer entries to prevent unbounded memory growth
const MAX_SCROLLBACK_ENTRIES = 100

// Saved terminal data with scrollback content
interface SavedTerminal {
  id: string
  workspaceId: string
  title: string
  cwd: string
  scrollbackContent?: string
  splitFromId?: string  // ID of the main terminal this is split from
}

type Listener = () => void

class WorkspaceStore {
  private state: AppState = {
    workspaces: [],
    activeWorkspaceId: null,
    terminals: [],
    activeTerminalId: null,
    focusedTerminalId: null,
    splitLayouts: {},
    splitTerminalId: null,
    splitDirection: null,
    focusedPane: 'main'
  }

  private listeners: Set<Listener> = new Set()

  // Session-only password cache (cleared on app restart, never persisted)
  // Maps workspaceId -> password for quick re-lock
  private sessionPasswords: Map<string, string> = new Map()

  getState(): AppState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener())
  }

  // Workspace actions
  addWorkspace(name: string, folderPath: string): Workspace {
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      folderPath,
      createdAt: Date.now()
    }

    this.state = {
      ...this.state,
      workspaces: [...this.state.workspaces, workspace],
      activeWorkspaceId: workspace.id
    }

    this.notify()
    return workspace
  }

  removeWorkspace(id: string): void {
    const terminals = this.state.terminals.filter(t => t.workspaceId !== id)
    const workspaces = this.state.workspaces.filter(w => w.id !== id)

    this.state = {
      ...this.state,
      workspaces,
      terminals,
      activeWorkspaceId: this.state.activeWorkspaceId === id
        ? (workspaces[0]?.id ?? null)
        : this.state.activeWorkspaceId
    }

    this.notify()
  }

  renameWorkspace(id: string, name: string): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, name } : w
      )
    }

    this.notify()
  }

  // Lock a workspace with encrypted data
  // Also removes terminals for this workspace (they're now encrypted)
  lockWorkspace(id: string, encryptedData: string, hint?: string): void {
    // Kill PTY processes for terminals in this workspace
    const terminalsToRemove = this.state.terminals.filter(t => t.workspaceId === id)
    terminalsToRemove.forEach(t => {
      tauriAPI.pty.kill(t.id)
    })

    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, isLocked: true, encryptedData, passwordHint: hint } : w
      ),
      // Remove terminals for this workspace
      terminals: this.state.terminals.filter(t => t.workspaceId !== id),
      // Clear focus if focused terminal was in this workspace
      focusedTerminalId: terminalsToRemove.some(t => t.id === this.state.focusedTerminalId)
        ? null
        : this.state.focusedTerminalId
    }

    this.notify()
  }

  // Unlock a workspace and restore terminals from decrypted data
  unlockWorkspace(id: string, restoredData?: {
    terminals: Array<{
      id: string
      title: string
      cwd: string
      splitFromId?: string
      scrollbackContent?: string
    }>
    splitTerminalId?: string | null
    splitDirection?: SplitDirection | null
  }): void {
    if (!restoredData?.terminals) {
      // No terminals to restore
      this.state = {
        ...this.state,
        workspaces: this.state.workspaces.map(w =>
          w.id === id ? { ...w, isLocked: false, encryptedData: undefined, passwordHint: undefined } : w
        )
      }
      this.notify()
      return
    }

    // Generate NEW IDs and create a mapping from old -> new
    const idMapping = new Map<string, string>()
    restoredData.terminals.forEach(t => {
      idMapping.set(t.id, uuidv4())
    })

    // Create terminals with new IDs, updating splitFromId references
    const newTerminals: TerminalInstance[] = restoredData.terminals.map(t => ({
      id: idMapping.get(t.id)!,
      workspaceId: id,
      title: t.title,
      cwd: t.cwd,
      scrollbackBuffer: [],
      savedScrollbackContent: t.scrollbackContent,
      // Map splitFromId to new ID
      splitFromId: t.splitFromId ? idMapping.get(t.splitFromId) : undefined
    }))

    // Find the new split terminal ID (if there was a split)
    const newSplitTerminalId = restoredData.splitTerminalId
      ? idMapping.get(restoredData.splitTerminalId) || null
      : null

    // Find main (non-split) terminals for focus
    const mainTerminals = newTerminals.filter(t => !t.splitFromId)

    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, isLocked: false, encryptedData: undefined, passwordHint: undefined } : w
      ),
      // Add restored terminals
      terminals: [...this.state.terminals, ...newTerminals],
      // Focus first main terminal
      focusedTerminalId: mainTerminals.length > 0 ? mainTerminals[0].id : this.state.focusedTerminalId,
      // Restore split state
      splitTerminalId: newSplitTerminalId,
      splitDirection: newSplitTerminalId ? restoredData.splitDirection || null : null,
      focusedPane: 'main'
    }

    this.notify()
  }

  // Check if workspace is locked
  isWorkspaceLocked(id: string): boolean {
    const workspace = this.state.workspaces.find(w => w.id === id)
    return workspace?.isLocked ?? false
  }

  // Get encrypted data for a workspace
  getWorkspaceEncryptedData(id: string): string | undefined {
    const workspace = this.state.workspaces.find(w => w.id === id)
    return workspace?.encryptedData
  }

  // Get password hint for a workspace
  getWorkspacePasswordHint(id: string): string | undefined {
    const workspace = this.state.workspaces.find(w => w.id === id)
    return workspace?.passwordHint
  }

  // Session password management (in-memory only, cleared on restart)
  setSessionPassword(id: string, password: string): void {
    this.sessionPasswords.set(id, password)
  }

  getSessionPassword(id: string): string | undefined {
    return this.sessionPasswords.get(id)
  }

  clearSessionPassword(id: string): void {
    this.sessionPasswords.delete(id)
  }

  hasSessionPassword(id: string): boolean {
    return this.sessionPasswords.has(id)
  }

  resetAll(): void {
    // Kill all terminals
    this.state.terminals.forEach(t => {
      tauriAPI.pty.kill(t.id)
    })

    this.state = {
      workspaces: [],
      activeWorkspaceId: null,
      terminals: [],
      activeTerminalId: null,
      focusedTerminalId: null,
      splitLayouts: {},
      splitTerminalId: null,
      splitDirection: null,
      focusedPane: 'main'
    }

    this.notify()
  }

  setActiveWorkspace(id: string): void {
    if (this.state.activeWorkspaceId === id) return

    this.state = {
      ...this.state,
      activeWorkspaceId: id,
      focusedTerminalId: null
    }

    this.notify()
  }

  // Terminal actions
  addTerminal(workspaceId: string): TerminalInstance {
    const workspace = this.state.workspaces.find(w => w.id === workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const existingTerminals = this.state.terminals.filter(
      t => t.workspaceId === workspaceId
    )

    const terminal: TerminalInstance = {
      id: uuidv4(),
      workspaceId,
      title: `Terminal ${existingTerminals.length + 1}`,
      cwd: workspace.folderPath,
      scrollbackBuffer: []
    }

    this.state = {
      ...this.state,
      terminals: [...this.state.terminals, terminal],
      focusedTerminalId: terminal.id  // Always focus new terminal
    }

    this.notify()
    return terminal
  }

  // Import a terminal with saved scrollback content (used by session import)
  importTerminal(workspaceId: string, data: {
    title: string
    cwd: string
    savedScrollbackContent?: string
    splitFromId?: string
  }): TerminalInstance {
    const workspace = this.state.workspaces.find(w => w.id === workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const terminal: TerminalInstance = {
      id: uuidv4(),
      workspaceId,
      title: data.title,
      cwd: data.cwd,
      scrollbackBuffer: [],
      savedScrollbackContent: data.savedScrollbackContent,
      splitFromId: data.splitFromId
    }

    // If this is a split terminal, update splitLayouts
    let newSplitLayouts = this.state.splitLayouts
    if (data.splitFromId) {
      const existingSplits = this.state.terminals.filter(t => t.splitFromId === data.splitFromId)
      newSplitLayouts = {
        ...newSplitLayouts,
        [data.splitFromId]: this.buildSplitLayout(data.splitFromId, [...existingSplits, terminal])
      }
    }

    this.state = {
      ...this.state,
      terminals: [...this.state.terminals, terminal],
      splitLayouts: newSplitLayouts,
      splitTerminalId: data.splitFromId ? terminal.id : this.state.splitTerminalId,
      splitDirection: data.splitFromId ? (this.state.splitDirection || 'horizontal') : this.state.splitDirection,
      focusedTerminalId: data.splitFromId ? this.state.focusedTerminalId : terminal.id
    }

    this.notify()
    return terminal
  }

  removeTerminal(id: string): void {
    const oldTerminals = this.state.terminals
    const terminals = oldTerminals.filter(t => t.id !== id)

    let newFocusedId = this.state.focusedTerminalId

    // If closing the focused terminal, switch to adjacent tab
    if (this.state.focusedTerminalId === id) {
      const closedTerminal = oldTerminals.find(t => t.id === id)
      if (closedTerminal) {
        // Get terminals in the same workspace (excluding split panes)
        const workspaceTerminals = oldTerminals.filter(
          t => t.workspaceId === closedTerminal.workspaceId && !t.splitFromId
        )
        const closedIndex = workspaceTerminals.findIndex(t => t.id === id)

        // Find the new terminal to focus (prefer previous, then next)
        const remainingWorkspaceTerminals = workspaceTerminals.filter(t => t.id !== id)
        if (remainingWorkspaceTerminals.length > 0) {
          // If closedIndex > 0, focus the previous tab; otherwise focus the new first tab
          const targetIndex = closedIndex > 0 ? closedIndex - 1 : 0
          newFocusedId = remainingWorkspaceTerminals[targetIndex]?.id ?? null
        } else {
          newFocusedId = null
        }
      } else {
        newFocusedId = terminals[0]?.id ?? null
      }
    }

    this.state = {
      ...this.state,
      terminals,
      focusedTerminalId: newFocusedId
    }

    this.notify()
  }

  reorderTerminals(workspaceId: string, fromIndex: number, toIndex: number): void {
    // Get terminals for this workspace (excluding split panes)
    const workspaceTerminals = this.state.terminals.filter(
      t => t.workspaceId === workspaceId && !t.splitFromId
    )
    const otherTerminals = this.state.terminals.filter(
      t => t.workspaceId !== workspaceId || t.splitFromId
    )

    if (fromIndex < 0 || fromIndex >= workspaceTerminals.length) return
    if (toIndex < 0 || toIndex >= workspaceTerminals.length) return

    // Reorder the workspace terminals
    const reordered = [...workspaceTerminals]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    // Merge back with other terminals
    this.state = {
      ...this.state,
      terminals: [...reordered, ...otherTerminals]
    }

    this.notify()
  }

  setFocusedTerminal(id: string | null): void {
    if (this.state.focusedTerminalId === id) return

    this.state = {
      ...this.state,
      focusedTerminalId: id
    }

    this.notify()
  }

  updateTerminalCwd(id: string, cwd: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, cwd } : t
      )
    }

    this.notify()
  }

  renameTerminal(id: string, title: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, title } : t
      )
    }

    this.notify()
  }

  appendScrollback(id: string, data: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t => {
        if (t.id !== id) return t
        // Limit buffer size to prevent unbounded memory growth
        const newBuffer = [...t.scrollbackBuffer, data]
        const limitedBuffer = newBuffer.length > MAX_SCROLLBACK_ENTRIES
          ? newBuffer.slice(-MAX_SCROLLBACK_ENTRIES)
          : newBuffer
        return { ...t, scrollbackBuffer: limitedBuffer }
      })
    }
    // Don't notify for scrollback updates to avoid re-renders
  }

  // Update terminal activity timestamp - called on PTY output
  // This is throttled to avoid excessive state updates
  private lastActivityUpdate: Map<string, number> = new Map()

  updateTerminalActivity(id: string): void {
    const now = Date.now()
    const lastUpdate = this.lastActivityUpdate.get(id) || 0

    // Throttle: only update if 500ms has passed since last update
    if (now - lastUpdate < 500) return

    this.lastActivityUpdate.set(id, now)
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, lastActivityTime: now } : t
      )
    }

    this.notify()
  }

  // Check if a terminal is currently active (had output within threshold)
  isTerminalActive(id: string): boolean {
    const terminal = this.state.terminals.find(t => t.id === id)
    if (!terminal?.lastActivityTime) return false
    return Date.now() - terminal.lastActivityTime < ACTIVITY_THRESHOLD_MS
  }

  // Get workspace activity status (any terminal active)
  isWorkspaceActive(workspaceId: string): boolean {
    const terminals = this.state.terminals.filter(t => t.workspaceId === workspaceId)
    return terminals.some(t => this.isTerminalActive(t.id))
  }

  clearScrollback(id: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, scrollbackBuffer: [] } : t
      )
    }

    this.notify()
  }

  // Get terminals for current workspace (excluding split panes)
  getWorkspaceTerminals(workspaceId: string): TerminalInstance[] {
    return this.state.terminals.filter(t => t.workspaceId === workspaceId && !t.splitFromId)
  }

  // Get ALL terminals for workspace including splits (for encryption)
  getAllWorkspaceTerminals(workspaceId: string): TerminalInstance[] {
    return this.state.terminals.filter(t => t.workspaceId === workspaceId)
  }

  // Split actions - supports up to 4 panes (2x2 grid)
  splitTerminal(terminalId: string, direction: SplitDirection = 'horizontal'): TerminalInstance | null {
    const terminal = this.state.terminals.find(t => t.id === terminalId)
    if (!terminal) return null

    const workspace = this.state.workspaces.find(w => w.id === terminal.workspaceId)
    if (!workspace) return null

    // Get current split terminals for this main terminal
    const existingSplits = this.state.terminals.filter(t => t.splitFromId === terminalId)
    
    // Limit to 3 splits (4 panes total including main)
    if (existingSplits.length >= 3) {
      return null
    }

    // Create a new terminal as the split pane
    const splitTerminal: TerminalInstance = {
      id: uuidv4(),
      workspaceId: terminal.workspaceId,
      title: `${terminal.title} (split ${existingSplits.length + 1})`,
      cwd: terminal.cwd,
      scrollbackBuffer: [],
      splitFromId: terminalId
    }
    console.log(`[WorkspaceStore] Created split terminal ${splitTerminal.id}, cwd: ${splitTerminal.cwd}, splitFromId: ${terminalId}, existingSplits: ${existingSplits.length}`)

    // Determine layout mode based on number of panes
    // 1 split = 2 panes (direction as specified)
    // 2+ splits = grid mode
    const newSplitDirection = existingSplits.length === 0 ? direction : this.state.splitDirection

    this.state = {
      ...this.state,
      terminals: [...this.state.terminals, splitTerminal],
      splitTerminalId: splitTerminal.id,
      splitDirection: newSplitDirection,
      splitLayouts: {
        ...this.state.splitLayouts,
        [terminalId]: this.buildSplitLayout(terminalId, [...existingSplits, splitTerminal])
      },
      focusedPane: splitTerminal.id  // Focus the newly created split terminal
    }

    this.notify()
    return splitTerminal
  }

  // Build split layout tree for a terminal and its splits
  private buildSplitLayout(mainTerminalId: string, splits: TerminalInstance[]): import('../types').SplitNode {
    if (splits.length === 0) {
      return { type: 'terminal', terminalId: mainTerminalId }
    }
    if (splits.length === 1) {
      // 2 panes: simple split
      return {
        type: 'split',
        direction: this.state.splitDirection || 'horizontal',
        first: { type: 'terminal', terminalId: mainTerminalId },
        second: { type: 'terminal', terminalId: splits[0].id },
        ratio: 0.5
      }
    }
    if (splits.length === 2) {
      // 3 panes: main + 2 splits (L-shape or T-shape)
      const dir = this.state.splitDirection || 'horizontal'
      return {
        type: 'split',
        direction: dir,
        first: { type: 'terminal', terminalId: mainTerminalId },
        second: {
          type: 'split',
          direction: dir === 'horizontal' ? 'vertical' : 'horizontal',
          first: { type: 'terminal', terminalId: splits[0].id },
          second: { type: 'terminal', terminalId: splits[1].id },
          ratio: 0.5
        },
        ratio: 0.5
      }
    }
    // 4 panes: 2x2 grid
    return {
      type: 'split',
      direction: 'horizontal',
      first: {
        type: 'split',
        direction: 'vertical',
        first: { type: 'terminal', terminalId: mainTerminalId },
        second: { type: 'terminal', terminalId: splits[0].id },
        ratio: 0.5
      },
      second: {
        type: 'split',
        direction: 'vertical',
        first: { type: 'terminal', terminalId: splits[1].id },
        second: { type: 'terminal', terminalId: splits[2].id },
        ratio: 0.5
      },
      ratio: 0.5
    }
  }

  // Get all split terminals for a main terminal
  getSplitTerminals(mainTerminalId: string): TerminalInstance[] {
    return this.state.terminals.filter(t => t.splitFromId === mainTerminalId)
  }

  // Get split layout for a terminal
  getSplitLayout(mainTerminalId: string): import('../types').SplitNode | null {
    return this.state.splitLayouts[mainTerminalId] || null
  }

  closeSplit(): void {
    const splitId = this.state.splitTerminalId
    if (!splitId) return

    const splitTerminal = this.state.terminals.find(t => t.id === splitId)
    const mainTerminalId = splitTerminal?.splitFromId

    // Kill the split terminal PTY
    tauriAPI.pty.kill(splitId)

    // Check remaining splits
    const remainingSplits = this.state.terminals.filter(
      t => t.splitFromId === mainTerminalId && t.id !== splitId
    )

    // Update split layouts
    const newSplitLayouts = { ...this.state.splitLayouts }
    if (mainTerminalId) {
      if (remainingSplits.length === 0) {
        delete newSplitLayouts[mainTerminalId]
      } else {
        newSplitLayouts[mainTerminalId] = this.buildSplitLayout(mainTerminalId, remainingSplits)
      }
    }

    this.state = {
      ...this.state,
      terminals: this.state.terminals.filter(t => t.id !== splitId),
      splitTerminalId: remainingSplits.length > 0 ? remainingSplits[remainingSplits.length - 1].id : null,
      splitDirection: remainingSplits.length > 0 ? this.state.splitDirection : null,
      splitLayouts: newSplitLayouts,
      focusedPane: 'main'
    }

    this.notify()
  }

  // Close all splits for a terminal
  closeAllSplits(mainTerminalId: string): void {
    const splits = this.getSplitTerminals(mainTerminalId)
    for (const split of splits) {
      tauriAPI.pty.kill(split.id)
    }

    const newSplitLayouts = { ...this.state.splitLayouts }
    delete newSplitLayouts[mainTerminalId]

    this.state = {
      ...this.state,
      terminals: this.state.terminals.filter(t => t.splitFromId !== mainTerminalId),
      splitTerminalId: null,
      splitDirection: null,
      splitLayouts: newSplitLayouts,
      focusedPane: 'main'
    }

    this.notify()
  }

  getSplitDirection(): SplitDirection | null {
    return this.state.splitDirection
  }

  setSplitDirection(direction: SplitDirection): void {
    if (!this.state.splitTerminalId) return
    if (this.state.splitDirection === direction) return

    this.state = {
      ...this.state,
      splitDirection: direction
    }

    this.notify()
  }

  getSplitTerminal(): TerminalInstance | null {
    if (!this.state.splitTerminalId) return null
    return this.state.terminals.find(t => t.id === this.state.splitTerminalId) || null
  }

  // Focused pane actions
  setFocusedPane(pane: FocusedPane): void {
    console.log('[WorkspaceStore] setFocusedPane called:', pane, 'current:', this.state.focusedPane)
    if (this.state.focusedPane === pane) {
      console.log('[WorkspaceStore] setFocusedPane skipped - same value')
      return
    }
    this.state = { ...this.state, focusedPane: pane }
    console.log('[WorkspaceStore] setFocusedPane updated to:', this.state.focusedPane)
    this.notify()
  }

  toggleFocusedPane(): void {
    if (!this.state.splitTerminalId) return // No split, can't toggle
    // Toggle between 'main' and the most recent split terminal
    const newPane = this.state.focusedPane === 'main'
      ? this.state.splitTerminalId  // Focus the most recent split
      : 'main'
    this.state = { ...this.state, focusedPane: newPane }
    this.notify()
  }

  getFocusedPane(): FocusedPane {
    return this.state.focusedPane
  }

  // Persistence
  async save(): Promise<void> {
    try {
      // Get scrollback content from terminal registry
      const terminalContents = getAllTerminalContents()

      // Save ALL terminals with their scrollback content (including split panes)
      const savedTerminals: SavedTerminal[] = this.state.terminals
        .map(t => ({
          id: t.id,
          workspaceId: t.workspaceId,
          title: t.title,
          cwd: t.cwd,
          scrollbackContent: terminalContents.get(t.id),
          splitFromId: t.splitFromId  // Preserve split relationship
        }))

      const data = JSON.stringify({
        schemaVersion: STORAGE_SCHEMA.WORKSPACE,
        savedAt: new Date().toISOString(),
        workspaces: this.state.workspaces,
        activeWorkspaceId: this.state.activeWorkspaceId,
        terminals: savedTerminals,
        focusedTerminalId: this.state.focusedTerminalId,
        // Save split state
        splitTerminalId: this.state.splitTerminalId,
        splitDirection: this.state.splitDirection,
        splitLayouts: this.state.splitLayouts,
        focusedPane: this.state.focusedPane
      })
      await tauriAPI.workspace.save(data)
    } catch (error) {
      console.error('[WorkspaceStore] Failed to save workspace:', error)
      // Don't throw - saving is a background operation
      toastEvents.error('Failed to save workspace data')
    }
  }

  async load(): Promise<void> {
    try {
      const data = await tauriAPI.workspace.load()
      if (data) {
        try {
          const parsed = JSON.parse(data)

          // Restore terminals from saved data (including split panes)
          const savedTerminals: SavedTerminal[] = parsed.terminals || []
          const terminals: TerminalInstance[] = savedTerminals.map(t => ({
            id: t.id,
            workspaceId: t.workspaceId,
            title: t.title,
            cwd: t.cwd,
            scrollbackBuffer: [],  // Will be restored when TerminalPanel mounts
            savedScrollbackContent: t.scrollbackContent,  // Store for restoration
            splitFromId: t.splitFromId  // Restore split relationship
          }))

          this.state = {
            ...this.state,
            workspaces: parsed.workspaces || [],
            activeWorkspaceId: parsed.activeWorkspaceId || null,
            terminals,
            focusedTerminalId: parsed.focusedTerminalId || null,
            // Restore split state
            splitTerminalId: parsed.splitTerminalId || null,
            splitDirection: parsed.splitDirection || null,
            splitLayouts: parsed.splitLayouts || {},
            focusedPane: parsed.focusedPane || 'main'
          }
          this.notify()
        } catch (e) {
          console.error('[WorkspaceStore] Failed to parse workspace data:', e)
        }
      }
    } catch (error) {
      console.error('[WorkspaceStore] Failed to load workspace:', error)
      // Continue with empty state - user can still use the app
    }
  }
}

export const workspaceStore = new WorkspaceStore()
