import { useState, useRef, useEffect } from 'react'
import type { Workspace } from '../types'
import { workspaceStore } from '../stores/workspace-store'
import { ActivityIndicator } from './ActivityIndicator'
import { RoleBadge } from './RoleBadge'

interface SidebarProps {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  onSelectWorkspace: (id: string) => void
  onAddWorkspace: () => void
  onRemoveWorkspace: (id: string) => void
  onSettingsClick: () => void
  onLockWorkspace: (id: string) => void
  onUnlockWorkspace: (id: string) => void
  showShortcutHints?: boolean
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  onRemoveWorkspace,
  onSettingsClick,
  onLockWorkspace,
  onUnlockWorkspace,
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
              // Collapsed: show number + activity indicator
              <>
                <span className="workspace-number">{index + 1}</span>
                <ActivityIndicator workspaceId={workspace.id} />
              </>
            ) : (
              // Expanded: show full content with role badge and activity
              <>
                {showShortcutHints && index < 9 && (
                  <span className="shortcut-hint">{index + 1}</span>
                )}
                <div className="workspace-item-content">
                  <ActivityIndicator workspaceId={workspace.id} />
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
                </div>
                <div className="workspace-meta">
                  <RoleBadge workspaceId={workspace.id} roleId={workspace.roleId} />
                  <span
                    className={`lock-icon ${workspace.isLocked ? 'locked' : 'unlocked'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (workspace.isLocked) {
                        onUnlockWorkspace(workspace.id)
                      } else {
                        onLockWorkspace(workspace.id)
                      }
                    }}
                    title={workspace.isLocked ? 'Unlock workspace' : 'Lock workspace'}
                  >
                    {workspace.isLocked ? '🔒' : '🔓'}
                  </span>
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveWorkspace(workspace.id)
                    }}
                  >
                    ×
                  </button>
                </div>
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
