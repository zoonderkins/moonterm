import { useState, useEffect, useCallback, useRef } from 'react'
import type { CommandBookmark } from '../types'
import {
  addBookmark,
  updateBookmark,
  deleteBookmark,
  searchBookmarks
} from '../lib/command-bookmarks'

interface BookmarksDialogProps {
  isOpen: boolean
  workspaceId: string
  onSelect: (command: string) => void
  onClose: () => void
  initialCommand?: string  // For adding from command history
}

type DialogMode = 'list' | 'add' | 'edit'

export function BookmarksDialog({
  isOpen,
  workspaceId,
  onSelect,
  onClose,
  initialCommand
}: BookmarksDialogProps) {
  const [mode, setMode] = useState<DialogMode>('list')
  const [query, setQuery] = useState('')
  const [bookmarks, setBookmarks] = useState<CommandBookmark[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Edit form state
  const [editBookmark, setEditBookmark] = useState<CommandBookmark | null>(null)
  const [formCommand, setFormCommand] = useState('')
  const [formAlias, setFormAlias] = useState('')
  const [formDescription, setFormDescription] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)

  // Load bookmarks when dialog opens
  useEffect(() => {
    if (isOpen) {
      const results = searchBookmarks(workspaceId, query)
      setBookmarks(results)
      setSelectedIndex(0)

      // If opening with a command to add, switch to add mode
      if (initialCommand) {
        setMode('add')
        setFormCommand(initialCommand)
        setFormAlias('')
        setFormDescription('')
      } else {
        setMode('list')
      }
    }
  }, [isOpen, workspaceId, query, initialCommand])

  // Focus appropriate input based on mode
  useEffect(() => {
    if (isOpen) {
      if (mode === 'list') {
        setQuery('')
        inputRef.current?.focus()
      } else {
        commandInputRef.current?.focus()
      }
    }
  }, [isOpen, mode])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || mode !== 'list') return
    const items = listRef.current.querySelectorAll('.bookmark-item')
    const selectedItem = items[selectedIndex] as HTMLElement | undefined
    selectedItem?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, mode])

  const refreshBookmarks = useCallback(() => {
    const results = searchBookmarks(workspaceId, query)
    setBookmarks(results)
  }, [workspaceId, query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mode !== 'list') {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMode('list')
        refreshBookmarks()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, bookmarks.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (bookmarks[selectedIndex]) {
          onSelect(bookmarks[selectedIndex].command)
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'Delete':
      case 'Backspace':
        // Only delete if input is empty and not focused
        if (!query && bookmarks[selectedIndex] && document.activeElement !== inputRef.current) {
          e.preventDefault()
          handleDelete(bookmarks[selectedIndex].id)
        }
        break
    }
  }, [mode, bookmarks, selectedIndex, query, onSelect, onClose, refreshBookmarks])

  const handleDelete = useCallback((bookmarkId: string) => {
    if (confirm('Delete this bookmark?')) {
      deleteBookmark(workspaceId, bookmarkId)
      refreshBookmarks()
      setSelectedIndex(prev => Math.max(0, prev - 1))
    }
  }, [workspaceId, refreshBookmarks])

  const handleEdit = useCallback((bookmark: CommandBookmark) => {
    setEditBookmark(bookmark)
    setFormCommand(bookmark.command)
    setFormAlias(bookmark.alias || '')
    setFormDescription(bookmark.description || '')
    setMode('edit')
  }, [])

  const handleAddNew = useCallback(() => {
    setEditBookmark(null)
    setFormCommand('')
    setFormAlias('')
    setFormDescription('')
    setMode('add')
  }, [])

  const handleSave = useCallback(() => {
    if (!formCommand.trim()) return

    if (mode === 'add') {
      addBookmark(workspaceId, formCommand, formAlias, formDescription)
    } else if (mode === 'edit' && editBookmark) {
      updateBookmark(workspaceId, editBookmark.id, {
        command: formCommand,
        alias: formAlias,
        description: formDescription
      })
    }

    setMode('list')
    refreshBookmarks()
  }, [mode, workspaceId, formCommand, formAlias, formDescription, editBookmark, refreshBookmarks])

  const handleItemClick = useCallback((bookmark: CommandBookmark) => {
    onSelect(bookmark.command)
    onClose()
  }, [onSelect, onClose])

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="bookmarks-dialog"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {mode === 'list' ? (
          <>
            <div className="bookmarks-header">
              <span className="bookmarks-title">Command Bookmarks</span>
              <button className="bookmarks-add-btn" onClick={handleAddNew}>
                + Add
              </button>
            </div>

            <div className="bookmarks-search">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search bookmarks..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="bookmarks-input"
              />
            </div>

            <div className="bookmarks-hint">
              ↑↓ select, Enter execute, E edit, Del delete, Esc close
            </div>

            <div className="bookmarks-list" ref={listRef}>
              {bookmarks.length === 0 ? (
                <div className="bookmarks-empty">
                  {query ? 'No matching bookmarks' : 'No bookmarks yet. Press "+ Add" to create one.'}
                </div>
              ) : (
                bookmarks.map((bookmark, index) => (
                  <div
                    key={bookmark.id}
                    className={`bookmark-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleItemClick(bookmark)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onDoubleClick={() => handleEdit(bookmark)}
                  >
                    <div className="bookmark-main">
                      <span className="bookmark-icon">★</span>
                      <div className="bookmark-content">
                        {bookmark.alias && (
                          <span className="bookmark-alias">{bookmark.alias}</span>
                        )}
                        <span className="bookmark-command">{bookmark.command}</span>
                      </div>
                    </div>
                    {bookmark.description && (
                      <div className="bookmark-description">{bookmark.description}</div>
                    )}
                    <div className="bookmark-actions">
                      <button
                        className="bookmark-action-btn"
                        onClick={(e) => { e.stopPropagation(); handleEdit(bookmark) }}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="bookmark-action-btn danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(bookmark.id) }}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bookmarks-header">
              <span className="bookmarks-title">
                {mode === 'add' ? 'Add Bookmark' : 'Edit Bookmark'}
              </span>
              <button className="bookmarks-cancel-btn" onClick={() => setMode('list')}>
                Cancel
              </button>
            </div>

            <div className="bookmarks-form">
              <div className="form-group">
                <label className="form-label">Command *</label>
                <input
                  ref={commandInputRef}
                  type="text"
                  value={formCommand}
                  onChange={e => setFormCommand(e.target.value)}
                  placeholder="e.g., git status"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alias (optional)</label>
                <input
                  type="text"
                  value={formAlias}
                  onChange={e => setFormAlias(e.target.value)}
                  placeholder="e.g., gs"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="e.g., Show git status"
                  className="form-input"
                />
              </div>

              <button
                className="form-submit-btn"
                onClick={handleSave}
                disabled={!formCommand.trim()}
              >
                {mode === 'add' ? 'Add Bookmark' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
