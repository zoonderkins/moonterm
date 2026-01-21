/**
 * Keybind Manager
 * Manages keyboard shortcuts with customization support
 */

export interface Keybind {
  id: string
  name: string
  description: string
  key: string           // Main key (e.g., 't', 'r', '1')
  modifiers: {
    cmd: boolean        // Cmd on Mac, Ctrl on Windows/Linux
    shift: boolean
    alt: boolean
  }
  category: 'terminal' | 'workspace' | 'navigation' | 'other'
}

// Default keybind definitions
const DEFAULT_KEYBINDS: Keybind[] = [
  // Terminal operations
  {
    id: 'new-tab',
    name: 'New Tab',
    description: 'Open a new terminal tab',
    key: 't',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'terminal'
  },
  {
    id: 'close-tab',
    name: 'Close Tab',
    description: 'Close the current terminal tab',
    key: 'w',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'terminal'
  },
  {
    id: 'split-horizontal',
    name: 'Split Horizontal',
    description: 'Split terminal horizontally (top/bottom)',
    key: 'd',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'terminal'
  },
  {
    id: 'split-vertical',
    name: 'Split Vertical',
    description: 'Split terminal vertically (left/right)',
    key: 'd',
    modifiers: { cmd: true, shift: true, alt: false },
    category: 'terminal'
  },
  {
    id: 'search',
    name: 'Search',
    description: 'Search in terminal output',
    key: 'f',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'terminal'
  },

  // Command management
  {
    id: 'command-history',
    name: 'Command History',
    description: 'Open command history dialog',
    key: 'r',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'other'
  },
  {
    id: 'bookmarks',
    name: 'Bookmarks',
    description: 'Open command bookmarks',
    key: 'b',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'other'
  },

  // Tab navigation (1-9)
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `switch-tab-${i + 1}`,
    name: `Switch to Tab ${i + 1}`,
    description: `Switch to terminal tab ${i + 1}`,
    key: String(i + 1),
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'navigation' as const
  })),

  // Workspace navigation (Ctrl+1-9)
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `switch-workspace-${i + 1}`,
    name: `Switch to Workspace ${i + 1}`,
    description: `Switch to workspace ${i + 1}`,
    key: String(i + 1),
    modifiers: { cmd: false, shift: false, alt: false },
    category: 'workspace' as const
  })),

  // Split pane navigation
  {
    id: 'focus-left',
    name: 'Focus Left Pane',
    description: 'Focus the left split pane',
    key: 'ArrowLeft',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'navigation'
  },
  {
    id: 'focus-right',
    name: 'Focus Right Pane',
    description: 'Focus the right split pane',
    key: 'ArrowRight',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'navigation'
  },
  {
    id: 'focus-up',
    name: 'Focus Top Pane',
    description: 'Focus the top split pane',
    key: 'ArrowUp',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'navigation'
  },
  {
    id: 'focus-down',
    name: 'Focus Bottom Pane',
    description: 'Focus the bottom split pane',
    key: 'ArrowDown',
    modifiers: { cmd: true, shift: false, alt: false },
    category: 'navigation'
  },
]

const STORAGE_KEY = 'custom-keybinds'

/**
 * Load custom keybinds from localStorage
 */
function loadCustomKeybinds(): Record<string, Partial<Keybind>> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return {}
    return JSON.parse(data)
  } catch {
    return {}
  }
}

/**
 * Save custom keybinds to localStorage
 */
function saveCustomKeybinds(custom: Record<string, Partial<Keybind>>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
}

/**
 * Get all keybinds with user customizations applied
 */
export function getKeybinds(): Keybind[] {
  const custom = loadCustomKeybinds()

  return DEFAULT_KEYBINDS.map(keybind => {
    const customized = custom[keybind.id]
    if (customized) {
      return {
        ...keybind,
        key: customized.key ?? keybind.key,
        modifiers: customized.modifiers ?? keybind.modifiers
      }
    }
    return keybind
  })
}

/**
 * Get a specific keybind by ID
 */
export function getKeybind(id: string): Keybind | undefined {
  return getKeybinds().find(k => k.id === id)
}

/**
 * Update a keybind
 */
export function updateKeybind(id: string, key: string, modifiers: Keybind['modifiers']): void {
  const custom = loadCustomKeybinds()
  custom[id] = { key, modifiers }
  saveCustomKeybinds(custom)
}

/**
 * Reset a keybind to default
 */
export function resetKeybind(id: string): void {
  const custom = loadCustomKeybinds()
  delete custom[id]
  saveCustomKeybinds(custom)
}

/**
 * Reset all keybinds to defaults
 */
export function resetAllKeybinds(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Check if a keybind matches the given keyboard event
 */
export function matchesKeybind(keybind: Keybind, e: KeyboardEvent): boolean {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Check modifiers
  const cmdMatch = keybind.modifiers.cmd
    ? (isMac ? e.metaKey : e.ctrlKey)
    : !(isMac ? e.metaKey : e.ctrlKey)
  const shiftMatch = keybind.modifiers.shift === e.shiftKey
  const altMatch = keybind.modifiers.alt === e.altKey

  // Check key
  const keyMatch = e.key.toLowerCase() === keybind.key.toLowerCase()

  return cmdMatch && shiftMatch && altMatch && keyMatch
}

/**
 * Find conflicting keybinds
 */
export function findConflicts(key: string, modifiers: Keybind['modifiers'], excludeId?: string): Keybind[] {
  const keybinds = getKeybinds()

  return keybinds.filter(k => {
    if (excludeId && k.id === excludeId) return false
    return k.key.toLowerCase() === key.toLowerCase() &&
           k.modifiers.cmd === modifiers.cmd &&
           k.modifiers.shift === modifiers.shift &&
           k.modifiers.alt === modifiers.alt
  })
}

/**
 * Format keybind for display
 */
export function formatKeybind(keybind: Keybind): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const parts: string[] = []

  if (keybind.modifiers.cmd) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (keybind.modifiers.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }
  if (keybind.modifiers.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }

  // Format special keys
  let keyDisplay = keybind.key
  if (keyDisplay === 'ArrowLeft') keyDisplay = '←'
  else if (keyDisplay === 'ArrowRight') keyDisplay = '→'
  else if (keyDisplay === 'ArrowUp') keyDisplay = '↑'
  else if (keyDisplay === 'ArrowDown') keyDisplay = '↓'
  else keyDisplay = keyDisplay.toUpperCase()

  parts.push(keyDisplay)

  return parts.join(isMac ? '' : '+')
}

/**
 * Get keybinds grouped by category
 */
export function getKeybindsByCategory(): Record<string, Keybind[]> {
  const keybinds = getKeybinds()
  const grouped: Record<string, Keybind[]> = {}

  for (const keybind of keybinds) {
    if (!grouped[keybind.category]) {
      grouped[keybind.category] = []
    }
    grouped[keybind.category].push(keybind)
  }

  return grouped
}

/**
 * Category display names
 */
export const CATEGORY_NAMES: Record<string, string> = {
  terminal: 'Terminal',
  workspace: 'Workspace',
  navigation: 'Navigation',
  other: 'Other'
}
