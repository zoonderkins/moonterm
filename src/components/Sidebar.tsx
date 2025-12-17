import { useState, useRef, useEffect } from 'react'
import type { Workspace } from '../types'
import { workspaceStore } from '../stores/workspace-store'

interface SidebarProps {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  onSelectWorkspace: (id: string) => void
  onAddWorkspace: () => void
  onRemoveWorkspace: (id: string) => void
  onSettingsClick: () => void
  showShortcutHints?: boolean
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  onRemoveWorkspace,
  onSettingsClick,
  showShortcutHints = false
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleToggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }

  const handleDoubleClick = (workspace: Workspace) => {
    if (isCollapsed) return // Can't edit in collapsed mode
    setEditValue(workspace.name)
    setEditingId(workspace.id)
  }

  const handleRename = () => {
    if (editingId && editValue.trim()) {
      workspaceStore.renameWorkspace(editingId, editValue.trim())
      workspaceStore.save()
    }
    setEditingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button
          className="collapse-btn"
          onClick={handleToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '☰' : '◀'}
        </button>
        {!isCollapsed && (
          <>
            <span className="sidebar-title">Workspaces</span>
            <button
              className="settings-btn"
              onClick={onSettingsClick}
              title="Settings"
            >
              ⚙
            </button>
          </>
        )}
      </div>
      <div className="workspace-list">
        {workspaces.map((workspace, index) => (
          <div
            key={workspace.id}
            className={`workspace-item ${workspace.id === activeWorkspaceId ? 'active' : ''}`}
            onClick={() => onSelectWorkspace(workspace.id)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              handleDoubleClick(workspace)
            }}
            title={isCollapsed ? workspace.name : undefined}
          >
            {isCollapsed ? (
              // Collapsed: show only number
              <span className="workspace-number">{index + 1}</span>
            ) : (
              // Expanded: show full content
              <>
                {showShortcutHints && index < 9 && (
                  <span className="shortcut-hint">{index + 1}</span>
                )}
                {editingId === workspace.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    className="rename-input workspace-rename"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="workspace-name">{workspace.name}</span>
                )}
                <button
                  className="remove-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveWorkspace(workspace.id)
                  }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <button
          className={`add-workspace-btn ${isCollapsed ? 'collapsed' : ''}`}
          onClick={onAddWorkspace}
          title="Add Workspace"
        >
          {isCollapsed ? '+' : '+ Add Workspace'}
        </button>
        {isCollapsed && (
          <button
            className="settings-btn-collapsed"
            onClick={onSettingsClick}
            title="Settings"
          >
            ⚙
          </button>
        )}
      </div>
    </aside>
  )
}
