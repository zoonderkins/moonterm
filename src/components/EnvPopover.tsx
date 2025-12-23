import { useState, useEffect, useRef } from 'react'
import { tauriAPI } from '../lib/tauri-bridge'
import { workspaceStore } from '../stores/workspace-store'
import type { EnvVarEntry } from '../types'

interface EnvPopoverProps {
  workspaceId: string
  terminalId: string
  onClose: () => void
  position: { x: number; y: number }
}

export function EnvPopover({ workspaceId, terminalId: _terminalId, onClose, position }: EnvPopoverProps) {
  const [envEntries, setEnvEntries] = useState<EnvVarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showSecrets, setShowSecrets] = useState(false)
  const [filter, setFilter] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadEnvVars()
  }, [workspaceId])

  useEffect(() => {
    // Close on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const loadEnvVars = async () => {
    setLoading(true)
    const entries: EnvVarEntry[] = []

    try {
      // Get workspace info
      const state = workspaceStore.getState()
      const workspace = state.workspaces.find(w => w.id === workspaceId)
      if (!workspace) {
        setLoading(false)
        return
      }

      // System env vars (always present)
      const systemVars: Record<string, string> = {
        'TERM': 'xterm-256color',
        'COLORTERM': 'truecolor',
        'TERM_PROGRAM': 'moonterm',
        'FORCE_COLOR': '1',
        'LANG': 'en_US.UTF-8',
      }
      for (const [key, value] of Object.entries(systemVars)) {
        entries.push({ key, value, source: 'system' })
      }

      // Workspace custom env vars
      if (workspace.envVars) {
        for (const [key, value] of Object.entries(workspace.envVars)) {
          entries.push({ key, value, source: 'workspace' })
        }
      }

      // Encrypted env vars (show as masked)
      if (workspace.encryptedEnvVars) {
        // We can't show the actual values without the password
        // Just indicate that encrypted vars exist
        entries.push({
          key: '[Encrypted Variables]',
          value: 'Unlock workspace to view',
          source: 'workspace',
          isSecret: true,
        })
      }

      // Read .env file if autoLoadEnv is enabled or by default
      if (workspace.autoLoadEnv !== false && workspace.folderPath) {
        try {
          const [hasEnv, hasEnvrc, envVars, envrcVars] = await tauriAPI.env.getFilesInfo(workspace.folderPath)

          if (hasEnv) {
            for (const [key, value] of Object.entries(envVars)) {
              entries.push({
                key,
                value,
                source: 'env_file',
                isSecret: isSecretKey(key),
              })
            }
          }

          if (hasEnvrc && workspace.autoLoadDirenv !== false) {
            for (const [key, value] of Object.entries(envrcVars)) {
              entries.push({
                key,
                value,
                source: 'direnv',
                isSecret: isSecretKey(key),
              })
            }
          }
        } catch (err) {
          console.warn('Failed to read env files:', err)
        }
      }

      setEnvEntries(entries)
    } catch (err) {
      console.error('Failed to load env vars:', err)
    }
    setLoading(false)
  }

  // Determine if a key is likely a secret
  const isSecretKey = (key: string): boolean => {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /key$/i,
      /token/i,
      /api_key/i,
      /apikey/i,
      /auth/i,
      /credential/i,
      /private/i,
    ]
    return secretPatterns.some(pattern => pattern.test(key))
  }

  const maskValue = (value: string): string => {
    if (value.length <= 4) return '****'
    return value.substring(0, 2) + '****' + value.substring(value.length - 2)
  }

  const getSourceBadge = (source: EnvVarEntry['source']) => {
    switch (source) {
      case 'system': return { label: 'SYS', color: '#666' }
      case 'workspace': return { label: 'WS', color: '#0078d4' }
      case 'env_file': return { label: '.env', color: '#4caf50' }
      case 'direnv': return { label: 'direnv', color: '#ff9800' }
    }
  }

  const filteredEntries = filter
    ? envEntries.filter(e => e.key.toLowerCase().includes(filter.toLowerCase()))
    : envEntries

  // Group by source
  const groupedEntries = {
    system: filteredEntries.filter(e => e.source === 'system'),
    workspace: filteredEntries.filter(e => e.source === 'workspace'),
    env_file: filteredEntries.filter(e => e.source === 'env_file'),
    direnv: filteredEntries.filter(e => e.source === 'direnv'),
  }

  return (
    <div
      ref={popoverRef}
      className="env-popover"
      style={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 400),
        top: Math.min(position.y, window.innerHeight - 300),
      }}
    >
      <div className="env-popover-header">
        <h4>Environment Variables</h4>
        <button className="env-popover-close" onClick={onClose}>×</button>
      </div>

      <div className="env-popover-toolbar">
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="env-filter-input"
        />
        <label className="env-show-secrets">
          <input
            type="checkbox"
            checked={showSecrets}
            onChange={e => setShowSecrets(e.target.checked)}
          />
          Show secrets
        </label>
      </div>

      <div className="env-popover-content">
        {loading ? (
          <div className="env-loading">Loading...</div>
        ) : (
          <>
            {Object.entries(groupedEntries).map(([source, entries]) => {
              if (entries.length === 0) return null
              const badge = getSourceBadge(source as EnvVarEntry['source'])
              return (
                <div key={source} className="env-group">
                  <div className="env-group-header">
                    <span
                      className="env-source-badge"
                      style={{ backgroundColor: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <span className="env-group-count">{entries.length}</span>
                  </div>
                  {entries.map((entry, idx) => (
                    <div key={`${entry.key}-${idx}`} className="env-entry">
                      <span className="env-key">{entry.key}</span>
                      <span className="env-value">
                        {entry.isSecret && !showSecrets
                          ? maskValue(entry.value)
                          : entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
            {filteredEntries.length === 0 && (
              <div className="env-empty">No environment variables found</div>
            )}
          </>
        )}
      </div>

      <div className="env-popover-footer">
        <span className="env-count">{filteredEntries.length} variables</span>
      </div>
    </div>
  )
}
