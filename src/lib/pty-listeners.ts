import { tauriAPI } from './tauri-bridge'

type OutputHandler = (data: string) => void
type ExitHandler = (exitCode: number) => void

const outputHandlers = new Map<string, OutputHandler>()
const exitHandlers = new Map<string, ExitHandler>()

let initialized = false

export async function initPtyListeners() {
  if (initialized) return
  initialized = true

  await tauriAPI.pty.onOutput((id, data) => {
    const handler = outputHandlers.get(id)
    if (handler) handler(data)
  })

  await tauriAPI.pty.onExit((id, exitCode) => {
    const handler = exitHandlers.get(id)
    if (handler) handler(exitCode)
  })
}

export function registerTerminal(
  id: string,
  onOutput: OutputHandler,
  onExit: ExitHandler
) {
  outputHandlers.set(id, onOutput)
  exitHandlers.set(id, onExit)
}

export function unregisterTerminal(id: string) {
  outputHandlers.delete(id)
  exitHandlers.delete(id)
}
