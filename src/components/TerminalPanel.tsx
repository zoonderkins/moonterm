import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SerializeAddon } from '@xterm/addon-serialize'
import '@xterm/xterm/css/xterm.css'
import { tauriAPI } from '../lib/tauri-bridge'
import { registerTerminal, unregisterTerminal } from '../lib/pty-listeners'
import { registerTerminalInstance, unregisterTerminalInstance } from '../lib/terminal-registry'
import { workspaceStore } from '../stores/workspace-store'

interface TerminalPanelProps {
  terminalId: string
  isActive: boolean
}

export function TerminalPanel({ terminalId, isActive }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      fontSize: 14,
      // Nerd Fonts for Powerline/Powerlevel10k support, with fallbacks
      fontFamily: '"MesloLGS NF", "FiraCode Nerd Font", "Hack Nerd Font", "JetBrainsMono Nerd Font", Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const serializeAddon = new SerializeAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(serializeAddon)
    terminal.open(containerRef.current)

    // Load WebGL addon for better font rendering and performance
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        console.warn('[Terminal] WebGL context lost, falling back to canvas')
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
      console.info('[Terminal] Using WebGL renderer (GPU accelerated)')
    } catch {
      // WebGL not available, fall back to canvas renderer
      console.warn('[Terminal] WebGL not available, using canvas renderer')
    }

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Register terminal for session export
    registerTerminalInstance(terminalId, terminal, serializeAddon)

    // Input handler
    terminal.onData((data) => {
      tauriAPI.pty.write(terminalId, data)
    })

    // Output handler
    registerTerminal(
      terminalId,
      (data) => terminal.write(data),
      (code) => {
        terminal.write(`\r\n[exit: ${code}]\r\n`)
        // Auto-close the terminal tab after a short delay
        setTimeout(() => {
          // Check if this is a split terminal
          const splitTerminal = workspaceStore.getSplitTerminal()
          if (splitTerminal?.id === terminalId) {
            workspaceStore.closeSplit()
          } else {
            // Also close split if this main terminal has one
            if (splitTerminal?.splitFromId === terminalId) {
              workspaceStore.closeSplit()
            }
            workspaceStore.removeTerminal(terminalId)
          }
        }, 500)
      }
    )

    // Resize with scroll position preservation
    const fit = () => {
      // Save current scroll position (distance from bottom)
      const buffer = terminal.buffer.active
      const scrollFromBottom = buffer.baseY + buffer.cursorY - terminal.buffer.active.viewportY

      fitAddon.fit()
      tauriAPI.pty.resize(terminalId, terminal.cols, terminal.rows)

      // Restore scroll position relative to bottom
      // This ensures the user's view is preserved after resize
      requestAnimationFrame(() => {
        const newBuffer = terminal.buffer.active
        const targetY = newBuffer.baseY + newBuffer.cursorY - scrollFromBottom
        terminal.scrollToLine(Math.max(0, targetY))
      })
    }
    const ro = new ResizeObserver(fit)
    ro.observe(containerRef.current)
    setTimeout(fit, 100)

    return () => {
      unregisterTerminal(terminalId)
      unregisterTerminalInstance(terminalId)
      ro.disconnect()
      terminal.dispose()
    }
  }, [terminalId])

  // Focus terminal when it becomes active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        terminalRef.current?.focus()
        // Also refit in case size changed while hidden
        fitAddonRef.current?.fit()
      }, 50)
    }
  }, [isActive])

  return <div ref={containerRef} className="terminal-panel" />
}
