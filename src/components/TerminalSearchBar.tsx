import { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchAddon } from '@xterm/addon-search'

interface TerminalSearchBarProps {
  isVisible: boolean
  searchAddon: SearchAddon | null
  onClose: () => void
}

export function TerminalSearchBar({ isVisible, searchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) {
      // Clear highlights when closing
      searchAddon?.clearDecorations()
      setMatchCount(null)
    }
  }, [isVisible, searchAddon])

  const handleSearch = useCallback((direction: 'next' | 'prev') => {
    if (!searchAddon || !query) return

    const options = {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    }

    let found: boolean
    if (direction === 'next') {
      found = searchAddon.findNext(query, options)
    } else {
      found = searchAddon.findPrevious(query, options)
    }

    // Update match indicator (xterm doesn't give us count, just found/not found)
    setMatchCount(found ? 1 : 0)
  }, [searchAddon, query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handleSearch('prev')
      } else {
        handleSearch('next')
      }
    }
  }, [onClose, handleSearch])

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)

    // Live search as you type
    if (searchAddon && newQuery) {
      const found = searchAddon.findNext(newQuery, {
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        incremental: true,
      })
      setMatchCount(found ? 1 : 0)
    } else {
      searchAddon?.clearDecorations()
      setMatchCount(null)
    }
  }, [searchAddon])

  if (!isVisible) return null

  return (
    <div className="terminal-search-bar">
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Search..."
        value={query}
        onChange={handleQueryChange}
        onKeyDown={handleKeyDown}
      />
      <div className="search-nav">
        <button
          className="search-btn"
          onClick={() => handleSearch('prev')}
          title="Previous (Shift+Enter)"
        >
          ↑
        </button>
        <button
          className="search-btn"
          onClick={() => handleSearch('next')}
          title="Next (Enter)"
        >
          ↓
        </button>
      </div>
      {matchCount !== null && (
        <span className={`search-status ${matchCount === 0 ? 'no-match' : ''}`}>
          {matchCount === 0 ? 'No matches' : 'Found'}
        </span>
      )}
      <button
        className="search-close-btn"
        onClick={onClose}
        title="Close (Esc)"
      >
        ×
      </button>
    </div>
  )
}
