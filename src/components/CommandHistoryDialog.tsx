import { useState, useEffect, useCallback, useRef } from 'react'
import { searchHistory } from '../lib/command-history'

interface CommandHistoryDialogProps {
  isOpen: boolean
  workspaceId: string
  onSelect: (command: string) => void
  onClose: () => void
}

export function CommandHistoryDialog({
  isOpen,
  workspaceId,
  onSelect,
  onClose
}: CommandHistoryDialogProps) {
  const [query, setQuery] = useState('')
  const [commands, setCommands] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load and filter commands when dialog opens or query changes
  useEffect(() => {
    if (isOpen) {
      const results = searchHistory(workspaceId, query)
      setCommands(results)
      setSelectedIndex(0)
    }
  }, [isOpen, workspaceId, query])

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('.command-history-item')
    const selectedItem = items[selectedIndex] as HTMLElement | undefined
    selectedItem?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, commands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (commands[selectedIndex]) {
          onSelect(commands[selectedIndex])
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [commands, selectedIndex, onSelect, onClose])

  const handleItemClick = useCallback((command: string) => {
    onSelect(command)
    onClose()
  }, [onSelect, onClose])

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="command-history-dialog"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-history-header">
          <span className="command-history-title">Command History</span>
          <span className="command-history-hint">↑↓ to select, Enter to execute, Esc to close</span>
        </div>

        <div className="command-history-search">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="command-history-input"
          />
        </div>

        <div className="command-history-list" ref={listRef}>
          {commands.length === 0 ? (
            <div className="command-history-empty">
              {query ? 'No matching commands' : 'No command history'}
            </div>
          ) : (
            commands.map((cmd, index) => (
              <div
                key={`${cmd}-${index}`}
                className={`command-history-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleItemClick(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="command-history-icon">$</span>
                <span className="command-history-command">{cmd}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
