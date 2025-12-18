import { useState, useRef, useEffect } from 'react'
import { WORKSPACE_ROLES } from '../types'
import { workspaceStore } from '../stores/workspace-store'

interface RoleBadgeProps {
  workspaceId: string
  roleId?: string
  compact?: boolean  // For collapsed sidebar
}

/**
 * Role Badge - Shows workspace role with icon and color
 *
 * Differentiated from Tony's approach:
 * - Uses emoji icons for better visual recognition
 * - Inline role selector (no separate dialog)
 * - Compact mode for collapsed sidebar
 */
export function RoleBadge({ workspaceId, roleId, compact = false }: RoleBadgeProps) {
  const [showSelector, setShowSelector] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  const role = roleId ? WORKSPACE_ROLES.find(r => r.id === roleId) : null

  // Close selector when clicking outside
  useEffect(() => {
    if (!showSelector) return

    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowSelector(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSelector])

  const handleRoleSelect = (newRoleId: string | undefined) => {
    workspaceStore.setWorkspaceRole(workspaceId, newRoleId)
    workspaceStore.save()
    setShowSelector(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowSelector(!showSelector)
  }

  if (compact) {
    // In compact mode, just show icon or a dot
    return (
      <span
        className="role-badge compact"
        onClick={handleClick}
        style={{
          backgroundColor: role?.color ? `${role.color}30` : 'transparent',
          color: role?.color || 'var(--text-secondary)',
        }}
        title={role?.name || 'Set role'}
      >
        {role?.icon || ''}
      </span>
    )
  }

  return (
    <div style={{ position: 'relative' }} ref={selectorRef}>
      <span
        className="role-badge"
        onClick={handleClick}
        style={{
          backgroundColor: role?.color ? `${role.color}30` : 'var(--bg-tertiary)',
          color: role?.color || 'var(--text-secondary)',
        }}
        title={role ? `${role.name} - Click to change` : 'Click to set role'}
      >
        {role ? (
          <>
            <span className="role-icon">{role.icon}</span>
            <span className="role-name">{role.name}</span>
          </>
        ) : (
          <span className="role-icon">+</span>
        )}
      </span>

      {showSelector && (
        <div className="role-selector">
          {WORKSPACE_ROLES.map(r => (
            <div
              key={r.id}
              className={`role-option ${r.id === roleId ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleRoleSelect(r.id)
              }}
            >
              <span className="role-icon">{r.icon}</span>
              <span>{r.name}</span>
            </div>
          ))}
          {roleId && (
            <div
              className="role-option role-option-clear"
              onClick={(e) => {
                e.stopPropagation()
                handleRoleSelect(undefined)
              }}
            >
              Clear role
            </div>
          )}
        </div>
      )}
    </div>
  )
}
