import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { SearchAddon } from '@xterm/addon-search'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import '@xterm/xterm/css/xterm.css'
import { tauriAPI } from '../lib/tauri-bridge'
import { registerTerminal, unregisterTerminal } from '../lib/pty-listeners'
import { registerTerminalInstance, unregisterTerminalInstance } from '../lib/terminal-registry'
import { workspaceStore } from '../stores/workspace-store'
import { TerminalSearchBar } from './TerminalSearchBar'
import { TerminalContextMenu } from './TerminalContextMenu'
import { getSavedFontSettings, getEffectiveFontFamily, FontSettings } from './SettingsDialog'
import { CommandInputBuffer } from '../lib/command-history'

interface TerminalPanelProps {
  terminalId: string
  isActive: boolean
  cwd?: string  // CWD for creating PTY
  savedScrollbackContent?: string  // Saved content to restore
  onActivity?: () => void  // Callback when terminal has new output
}

export function TerminalPanel({ terminalId, isActive, cwd, savedScrollbackContent, onActivity }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const ligaturesAddonRef = useRef<LigaturesAddon | null>(null)
  const commandBufferRef = useRef<CommandInputBuffer | null>(null)

  // Ref to hold latest onActivity callback (avoids useEffect dep causing terminal dispose)
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity

  // Search bar state
  const [showSearch, setShowSearch] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const fontSettings = getSavedFontSettings()
    const effectiveFontFamily = getEffectiveFontFamily(fontSettings)
    const terminal = new Terminal({
      fontSize: fontSettings.fontSize,
      fontFamily: effectiveFontFamily,
      cursorBlink: true,
      scrollback: 5000,  // Limit scrollback for storage efficiency
      allowProposedApi: true,
      // Convert LF to CRLF - important for apps that only send \n
      convertEol: true,
      // Improve rendering for TUI apps like Claude Code
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      // Reduce visual glitches during rapid updates
      smoothScrollDuration: 0,
    })

    const fitAddon = new FitAddon()
    const serializeAddon = new SerializeAddon()
    const unicode11Addon = new Unicode11Addon()
    const searchAddon = new SearchAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(serializeAddon)
    terminal.loadAddon(unicode11Addon)
    terminal.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon
    // Activate Unicode 11 for better emoji and special character support
    terminal.unicode.activeVersion = '11'
    terminal.open(containerRef.current)

    // Restore saved scrollback content if available
    if (savedScrollbackContent) {
      terminal.write(savedScrollbackContent)
    }

    // Load WebGL addon for better font rendering and performance
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        console.warn('[Terminal] WebGL context lost, falling back to canvas')
        webglAddon.dispose()
        webglAddonRef.current = null
      })
      terminal.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
      console.info('[Terminal] Using WebGL renderer (GPU accelerated)')
    } catch {
      // WebGL not available, fall back to canvas renderer
      console.warn('[Terminal] WebGL not available, using canvas renderer')
    }

    // Load ligatures addon if enabled
    if (fontSettings.ligatures) {
      try {
        const ligaturesAddon = new LigaturesAddon()
        terminal.loadAddon(ligaturesAddon)
        ligaturesAddonRef.current = ligaturesAddon
        console.info('[Terminal] Ligatures enabled')
      } catch (err) {
        console.warn('[Terminal] Failed to load ligatures addon:', err)
      }
    }

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Register terminal for session export
    registerTerminalInstance(terminalId, terminal, serializeAddon)

    // Create PTY for this terminal (will be no-op if already exists on Rust side)
    if (cwd) {
      tauriAPI.pty.create({ id: terminalId, cwd })
    }

    // Initialize command history buffer
    // Get workspaceId from the terminal instance
    const terminalInstance = workspaceStore.getState().terminals.find(t => t.id === terminalId)
    if (terminalInstance) {
      commandBufferRef.current = new CommandInputBuffer(terminalInstance.workspaceId)
    }

    // Input handler - also captures commands for history
    terminal.onData((data) => {
      // Track command input for history (before sending to PTY)
      commandBufferRef.current?.processInput(data)
      tauriAPI.pty.write(terminalId, data)
    })

    // Output handler with activity notification
    registerTerminal(
      terminalId,
      (data) => {
        terminal.write(data)
        // Notify activity for inactive terminals
        if (onActivityRef.current) onActivityRef.current()
      },
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
          // Save immediately to persist the closed tab state
          workspaceStore.save()
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

    // Listen for font settings changes
    const handleFontChange = async (e: Event) => {
      const settings = (e as CustomEvent<FontSettings>).detail
      console.log('[Terminal] Font settings changed:', settings)

      // Compute effective font family (including icon font fallback)
      const effectiveFont = getEffectiveFontFamily(settings)
      terminal.options.fontFamily = effectiveFont
      terminal.options.fontSize = settings.fontSize

      // Wait for new font to load before refreshing
      await document.fonts.ready

      // Handle ligatures addon
      if (settings.ligatures && !ligaturesAddonRef.current) {
        // Enable ligatures
        try {
          const ligaturesAddon = new LigaturesAddon()
          terminal.loadAddon(ligaturesAddon)
          ligaturesAddonRef.current = ligaturesAddon
          console.log('[Terminal] Ligatures enabled')
        } catch (err) {
          console.warn('[Terminal] Failed to load ligatures addon:', err)
        }
      } else if (!settings.ligatures && ligaturesAddonRef.current) {
        // Disable ligatures
        try {
          ligaturesAddonRef.current.dispose()
          ligaturesAddonRef.current = null
          console.log('[Terminal] Ligatures disabled')
        } catch {
          // Ignore dispose errors
        }
      }

      // Dispose and recreate WebGL addon to fully clear font cache
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose()
          webglAddonRef.current = null
        } catch {
          // Ignore dispose errors
        }

        // Recreate WebGL addon with fresh font cache
        try {
          const newWebglAddon = new WebglAddon()
          newWebglAddon.onContextLoss(() => {
            console.warn('[Terminal] WebGL context lost after font change')
            newWebglAddon.dispose()
            webglAddonRef.current = null
          })
          terminal.loadAddon(newWebglAddon)
          webglAddonRef.current = newWebglAddon
          console.log('[Terminal] WebGL addon recreated for new font')
        } catch {
          console.warn('[Terminal] Failed to recreate WebGL addon')
        }
      }

      // Recalculate dimensions and force full redraw
      fitAddon.fit()
      terminal.refresh(0, terminal.rows - 1)
      console.log('[Terminal] Font applied:', terminal.options.fontFamily)
    }
    window.addEventListener('font-settings-changed', handleFontChange)

    // Ensure fonts are loaded before initial render
    document.fonts.ready.then(() => {
      terminal.refresh(0, terminal.rows - 1)
    })

    return () => {
      unregisterTerminal(terminalId)
      unregisterTerminalInstance(terminalId)
      ro.disconnect()
      window.removeEventListener('font-settings-changed', handleFontChange)
      // Explicitly dispose WebGL addon to prevent context leak
      if (webglAddonRef.current) {
        webglAddonRef.current.dispose()
        webglAddonRef.current = null
      }
      // Dispose ligatures addon
      if (ligaturesAddonRef.current) {
        ligaturesAddonRef.current.dispose()
        ligaturesAddonRef.current = null
      }
      searchAddonRef.current = null
      commandBufferRef.current = null
      terminal.dispose()
    }
  // Note: onActivity is intentionally excluded from deps to prevent terminal dispose on callback change
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Keyboard handler for Cmd+F (search)
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (modKey && e.key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        setShowSearch(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isActive])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Copy selection to clipboard
  const handleCopy = useCallback(() => {
    const selection = terminalRef.current?.getSelection()
    if (selection) {
      navigator.clipboard.writeText(selection)
    }
  }, [])

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && terminalRef.current) {
        tauriAPI.pty.write(terminalId, text)
      }
    } catch (err) {
      console.error('Paste failed:', err)
    }
  }, [terminalId])

  // Clear terminal
  const handleClear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  // Select all
  const handleSelectAll = useCallback(() => {
    terminalRef.current?.selectAll()
  }, [])

  // Get context menu items
  const contextMenuItems = [
    {
      label: 'Copy',
      action: handleCopy,
      shortcut: 'Cmd+C',
      disabled: !terminalRef.current?.hasSelection()
    },
    {
      label: 'Paste',
      action: handlePaste,
      shortcut: 'Cmd+V'
    },
    { divider: true, label: '', action: () => {} },
    {
      label: 'Select All',
      action: handleSelectAll,
      shortcut: 'Cmd+A'
    },
    {
      label: 'Clear',
      action: handleClear
    },
    { divider: true, label: '', action: () => {} },
    {
      label: 'Find...',
      action: () => setShowSearch(true),
      shortcut: 'Cmd+F'
    }
  ]

  return (
    <div className="terminal-panel-wrapper">
      <TerminalSearchBar
        isVisible={showSearch}
        searchAddon={searchAddonRef.current}
        onClose={() => {
          setShowSearch(false)
          terminalRef.current?.focus()
        }}
      />
      <div
        ref={containerRef}
        className="terminal-panel"
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <TerminalContextMenu
          position={contextMenu}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
