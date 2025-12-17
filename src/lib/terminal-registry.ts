import type { Terminal } from '@xterm/xterm'
import type { SerializeAddon } from '@xterm/addon-serialize'

interface TerminalEntry {
  terminal: Terminal
  serializeAddon: SerializeAddon
}

// Global registry to store terminal instances for session export
const terminalRegistry = new Map<string, TerminalEntry>()

export function registerTerminalInstance(
  id: string,
  terminal: Terminal,
  serializeAddon: SerializeAddon
): void {
  terminalRegistry.set(id, { terminal, serializeAddon })
}

export function unregisterTerminalInstance(id: string): void {
  terminalRegistry.delete(id)
}

export function getTerminalContent(id: string): string | null {
  const entry = terminalRegistry.get(id)
  if (!entry) return null

  try {
    return entry.serializeAddon.serialize()
  } catch {
    return null
  }
}

export function getAllTerminalContents(): Map<string, string> {
  const contents = new Map<string, string>()

  for (const [id, entry] of terminalRegistry) {
    try {
      contents.set(id, entry.serializeAddon.serialize())
    } catch {
      // Skip failed serialization
    }
  }

  return contents
}
