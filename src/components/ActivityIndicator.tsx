import { useState, useEffect } from 'react'
import { workspaceStore } from '../stores/workspace-store'

interface ActivityIndicatorProps {
  workspaceId: string
}

/**
 * Activity Indicator - Shows workspace activity status with breathing animation
 *
 * Differentiated from Tony's approach:
 * - Activity tracking happens in Rust PTY layer (via pty-listeners)
 * - Throttled updates (500ms) reduce IPC overhead
 * - Uses CSS variables for theme consistency
 */
export function ActivityIndicator({ workspaceId }: ActivityIndicatorProps) {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    // Check activity status periodically
    const checkActivity = () => {
      setIsActive(workspaceStore.isWorkspaceActive(workspaceId))
    }

    // Initial check
    checkActivity()

    // Poll every second (much less frequent than per-output)
    const interval = setInterval(checkActivity, 1000)

    // Also subscribe to store changes for immediate updates
    const unsubscribe = workspaceStore.subscribe(checkActivity)

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [workspaceId])

  return (
    <span
      className={`activity-indicator ${isActive ? 'active' : 'idle'}`}
      title={isActive ? 'Active (output in last 10s)' : 'Idle'}
    />
  )
}

interface TerminalActivityIndicatorProps {
  terminalId: string
}

export function TerminalActivityIndicator({ terminalId }: TerminalActivityIndicatorProps) {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const checkActivity = () => {
      setIsActive(workspaceStore.isTerminalActive(terminalId))
    }

    checkActivity()
    const interval = setInterval(checkActivity, 1000)
    const unsubscribe = workspaceStore.subscribe(checkActivity)

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [terminalId])

  return (
    <span
      className={`activity-indicator ${isActive ? 'active' : 'idle'}`}
      title={isActive ? 'Active' : 'Idle'}
    />
  )
}
