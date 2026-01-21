import { useState, useEffect, useCallback, useRef } from 'react'
import type { Keybind } from '../lib/keybind-manager'
import {
  getKeybindsByCategory,
  formatKeybind,
  updateKeybind,
  resetKeybind,
  findConflicts,
  CATEGORY_NAMES
} from '../lib/keybind-manager'

interface KeybindSettingsProps {
  onKeybindsChanged?: () => void
}

export function KeybindSettings({ onKeybindsChanged }: KeybindSettingsProps) {
  const [keybindsByCategory, setKeybindsByCategory] = useState<Record<string, Keybind[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [capturedKey, setCapturedKey] = useState<{ key: string; modifiers: Keybind['modifiers'] } | null>(null)
  const [conflicts, setConflicts] = useState<Keybind[]>([])

  const captureRef = useRef<HTMLDivElement>(null)

  // Load keybinds
  useEffect(() => {
    setKeybindsByCategory(getKeybindsByCategory())
  }, [])

  // Focus capture element when editing
  useEffect(() => {
    if (editingId && captureRef.current) {
      captureRef.current.focus()
    }
  }, [editingId])

  const handleStartEdit = useCallback((keybindId: string) => {
    setEditingId(keybindId)
    setCapturedKey(null)
    setConflicts([])
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setCapturedKey(null)
    setConflicts([])
  }, [])

  const handleKeyCapture = useCallback((e: React.KeyboardEvent) => {
    if (!editingId) return

    e.preventDefault()
    e.stopPropagation()

    // Ignore modifier-only keys
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
      return
    }

    // Escape cancels editing
    if (e.key === 'Escape') {
      handleCancelEdit()
      return
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modifiers: Keybind['modifiers'] = {
      cmd: isMac ? e.metaKey : e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey
    }

    const captured = { key: e.key, modifiers }
    setCapturedKey(captured)

    // Check for conflicts
    const conflicting = findConflicts(e.key, modifiers, editingId)
    setConflicts(conflicting)
  }, [editingId, handleCancelEdit])

  const handleSaveKeybind = useCallback(() => {
    if (!editingId || !capturedKey) return

    updateKeybind(editingId, capturedKey.key, capturedKey.modifiers)
    setKeybindsByCategory(getKeybindsByCategory())
    setEditingId(null)
    setCapturedKey(null)
    setConflicts([])
    onKeybindsChanged?.()
  }, [editingId, capturedKey, onKeybindsChanged])

  const handleResetKeybind = useCallback((keybindId: string) => {
    resetKeybind(keybindId)
    setKeybindsByCategory(getKeybindsByCategory())
    onKeybindsChanged?.()
  }, [onKeybindsChanged])

  const formatCapturedKey = useCallback(() => {
    if (!capturedKey) return ''

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const parts: string[] = []

    if (capturedKey.modifiers.cmd) parts.push(isMac ? '⌘' : 'Ctrl')
    if (capturedKey.modifiers.shift) parts.push(isMac ? '⇧' : 'Shift')
    if (capturedKey.modifiers.alt) parts.push(isMac ? '⌥' : 'Alt')

    let keyDisplay = capturedKey.key
    if (keyDisplay === 'ArrowLeft') keyDisplay = '←'
    else if (keyDisplay === 'ArrowRight') keyDisplay = '→'
    else if (keyDisplay === 'ArrowUp') keyDisplay = '↑'
    else if (keyDisplay === 'ArrowDown') keyDisplay = '↓'
    else keyDisplay = keyDisplay.toUpperCase()

    parts.push(keyDisplay)
    return parts.join(isMac ? '' : '+')
  }, [capturedKey])

  return (
    <div className="keybind-settings">
      {Object.entries(keybindsByCategory).map(([category, keybinds]) => (
        <div key={category} className="keybind-category">
          <h4 className="keybind-category-title">{CATEGORY_NAMES[category] || category}</h4>
          <div className="keybind-list">
            {keybinds.map((keybind) => (
              <div key={keybind.id} className="keybind-item">
                <div className="keybind-info">
                  <span className="keybind-name">{keybind.name}</span>
                  <span className="keybind-description">{keybind.description}</span>
                </div>
                <div className="keybind-actions">
                  {editingId === keybind.id ? (
                    <div className="keybind-editor">
                      <div
                        ref={captureRef}
                        tabIndex={0}
                        className="keybind-capture"
                        onKeyDown={handleKeyCapture}
                      >
                        {capturedKey ? formatCapturedKey() : 'Press keys...'}
                      </div>
                      {conflicts.length > 0 && (
                        <div className="keybind-conflict">
                          Conflicts with: {conflicts.map(c => c.name).join(', ')}
                        </div>
                      )}
                      <div className="keybind-editor-actions">
                        <button
                          className="keybind-btn save"
                          onClick={handleSaveKeybind}
                          disabled={!capturedKey}
                        >
                          Save
                        </button>
                        <button
                          className="keybind-btn cancel"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="keybind-shortcut">{formatKeybind(keybind)}</span>
                      <button
                        className="keybind-edit-btn"
                        onClick={() => handleStartEdit(keybind.id)}
                        title="Edit keybind"
                      >
                        ✎
                      </button>
                      <button
                        className="keybind-reset-btn"
                        onClick={() => handleResetKeybind(keybind.id)}
                        title="Reset to default"
                      >
                        ↺
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
