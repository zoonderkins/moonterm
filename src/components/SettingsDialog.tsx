import { useState, useEffect, useRef } from 'react'
import { tauriAPI } from '../lib/tauri-bridge'
import { workspaceStore } from '../stores/workspace-store'
import { downloadSessionFile, importSession } from '../lib/session-manager'
import { STORAGE_SCHEMA } from '../lib/version'

// Font options for terminal (use Mono variants for proper terminal rendering)
export const fontOptions = [
  { value: '"MesloLGS NF", "MesloLGS Nerd Font Mono", monospace', label: 'MesloLGS NF (Recommended)' },
  { value: '"Hack Nerd Font Mono", monospace', label: 'Hack Nerd Font Mono' },
  { value: '"FiraCode Nerd Font Mono", monospace', label: 'FiraCode Nerd Font Mono' },
  { value: '"JetBrainsMono Nerd Font Mono", monospace', label: 'JetBrains Mono Nerd Font' },
  { value: 'Menlo, Monaco, "Courier New", monospace', label: 'System Default' },
]

export interface FontSettings {
  fontFamily: string
  fontSize: number
}

const DEFAULT_FONT_SETTINGS: FontSettings = {
  fontFamily: '"MesloLGS NF", "MesloLGS Nerd Font Mono", "Hack Nerd Font Mono", "FiraCode Nerd Font Mono", "JetBrainsMono Nerd Font Mono", Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
}

// Get saved font settings
export function getSavedFontSettings(): FontSettings {
  try {
    const saved = localStorage.getItem('terminal-font-settings')
    if (saved) {
      return { ...DEFAULT_FONT_SETTINGS, ...JSON.parse(saved) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_FONT_SETTINGS
}

// Save font settings and notify terminals
export function saveFontSettings(settings: FontSettings) {
  localStorage.setItem('terminal-font-settings', JSON.stringify(settings))
  // Dispatch event to notify all terminals
  window.dispatchEvent(new CustomEvent('font-settings-changed', { detail: settings }))
}

// Theme definitions
export const themes = {
  default: {
    name: 'Default (Dark)',
    colors: {
      '--bg-primary': '#1e1e1e',
      '--bg-secondary': '#252526',
      '--bg-tertiary': '#2d2d2d',
      '--bg-hover': '#3c3c3c',
      '--text-primary': '#cccccc',
      '--text-secondary': '#888888',
      '--border-color': '#404040',
      '--accent-color': '#0078d4',
      '--terminal-bg': '#1e1e1e',
    }
  },
  purple: {
    name: 'Purple Night',
    colors: {
      '--bg-primary': '#1a1625',
      '--bg-secondary': '#2d2640',
      '--bg-tertiary': '#3d3455',
      '--bg-hover': '#4d4465',
      '--text-primary': '#e0d4f7',
      '--text-secondary': '#9d8dc2',
      '--border-color': '#5a4d7a',
      '--accent-color': '#9d4edd',
      '--terminal-bg': '#1a1625',
    }
  },
  pink: {
    name: 'Pink Blossom',
    colors: {
      '--bg-primary': '#1f1a1c',
      '--bg-secondary': '#2d2528',
      '--bg-tertiary': '#3d3235',
      '--bg-hover': '#4d4245',
      '--text-primary': '#f5e0e6',
      '--text-secondary': '#c29da6',
      '--border-color': '#5a4d52',
      '--accent-color': '#e91e8c',
      '--terminal-bg': '#1f1a1c',
    }
  },
  black: {
    name: 'Pure Black',
    colors: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#1a1a1a',
      '--bg-tertiary': '#262626',
      '--bg-hover': '#363636',
      '--text-primary': '#ffffff',
      '--text-secondary': '#b8b8b8',
      '--border-color': '#4a4a4a',
      '--accent-color': '#ffffff',
      '--terminal-bg': '#000000',
    }
  },
  colorblind: {
    name: 'Colorblind Safe',
    colors: {
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-tertiary': '#0f3460',
      '--bg-hover': '#1a4070',
      '--text-primary': '#e8e8e8',  // Near white for high contrast
      '--text-secondary': '#a0a0a0',
      '--border-color': '#3a5a80',
      '--accent-color': '#e6a117',  // Orange/amber - colorblind safe
      '--terminal-bg': '#1a1a2e',
    }
  },
}

export type ThemeKey = keyof typeof themes

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  currentTheme: ThemeKey
  onThemeChange: (theme: ThemeKey) => void
}

export function SettingsDialog({ isOpen, onClose, currentTheme, onThemeChange }: SettingsDialogProps) {
  const [configPath, setConfigPath] = useState<string>('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fontSettings, setFontSettings] = useState<FontSettings>(getSavedFontSettings)

  useEffect(() => {
    if (isOpen) {
      tauriAPI.workspace.getConfigPath().then(setConfigPath).catch(() => {})
      setImportStatus(null) // Clear status when dialog opens
      setFontSettings(getSavedFontSettings()) // Reload font settings
    }
  }, [isOpen])

  const handleFontFamilyChange = (value: string) => {
    const newSettings = { ...fontSettings, fontFamily: value }
    setFontSettings(newSettings)
    saveFontSettings(newSettings)
  }

  const handleFontSizeChange = (value: number) => {
    const size = Math.min(24, Math.max(10, value))
    const newSettings = { ...fontSettings, fontSize: size }
    setFontSettings(newSettings)
    saveFontSettings(newSettings)
  }

  const handleExport = () => {
    downloadSessionFile()
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await importSession(file)
    setImportStatus(result)

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleReset = () => {
    workspaceStore.resetAll()
    workspaceStore.save()
    setShowResetConfirm(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        {/* Theme Selection */}
        <div className="settings-section">
          <label className="settings-label">Theme</label>
          <div className="theme-grid">
            {(Object.keys(themes) as ThemeKey[]).map((key) => (
              <button
                key={key}
                className={`theme-option ${currentTheme === key ? 'active' : ''}`}
                onClick={() => onThemeChange(key)}
                style={{
                  backgroundColor: themes[key].colors['--bg-primary'],
                  borderColor: currentTheme === key ? themes[key].colors['--accent-color'] : themes[key].colors['--border-color'],
                }}
              >
                <span
                  className="theme-accent"
                  style={{ backgroundColor: themes[key].colors['--accent-color'] }}
                />
                <span className="theme-name" style={{ color: themes[key].colors['--text-primary'] }}>
                  {themes[key].name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Settings */}
        <div className="settings-section">
          <label className="settings-label">Terminal Font</label>
          <div className="font-settings">
            <div className="font-setting-row">
              <label>Font Family</label>
              <select
                className="font-select"
                value={fontOptions.find(f => f.value === fontSettings.fontFamily)?.value || fontOptions[fontOptions.length - 1].value}
                onChange={(e) => handleFontFamilyChange(e.target.value)}
              >
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="font-setting-row">
              <label>Font Size</label>
              <div className="font-size-input">
                <button
                  className="font-size-btn"
                  onClick={() => handleFontSizeChange(fontSettings.fontSize - 1)}
                  disabled={fontSettings.fontSize <= 10}
                >
                  −
                </button>
                <span className="font-size-value">{fontSettings.fontSize}px</span>
                <button
                  className="font-size-btn"
                  onClick={() => handleFontSizeChange(fontSettings.fontSize + 1)}
                  disabled={fontSettings.fontSize >= 24}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="settings-hint-block">
            <span>Install Nerd Fonts:</span>
            <code>brew install --cask font-meslo-lg-nerd-font</code>
          </div>
        </div>

        {/* Config Path */}
        <div className="settings-section">
          <label className="settings-label">Data Location</label>
          <div className="config-path">
            <code>{configPath || 'Loading...'}</code>
          </div>
        </div>

        {/* Session Export/Import */}
        <div className="settings-section">
          <label className="settings-label">Session</label>
          <div className="session-actions">
            <button className="session-btn" onClick={handleExport}>
              Export Session
            </button>
            <button className="session-btn" onClick={handleImportClick}>
              Import Session
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
          {importStatus && (
            <div className={`import-status ${importStatus.success ? 'success' : 'error'}`}>
              {importStatus.message}
            </div>
          )}
          <p className="settings-hint">
            Export saves workspace layout, theme, and terminal content snapshot.
          </p>
        </div>

        {/* About */}
        <div className="settings-section">
          <label className="settings-label">About</label>
          <div className="github-link">
            <a
              href="https://github.com/zoonderkins/moonterm"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                window.open('https://github.com/zoonderkins/moonterm', '_blank')
              }}
            >
              GitHub Repository
            </a>
          </div>
          <div className="schema-versions">
            <p className="settings-hint" style={{ marginBottom: '4px' }}>Storage Schema Versions:</p>
            <div className="schema-list">
              <code>Workspace: {STORAGE_SCHEMA.WORKSPACE}</code>
              <code>Session: {STORAGE_SCHEMA.SESSION}</code>
              <code>Settings: {STORAGE_SCHEMA.SETTINGS}</code>
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="settings-section">
          <label className="settings-label">Reset</label>
          {showResetConfirm ? (
            <div className="reset-confirm">
              <p>This will close all terminals and remove all workspaces.</p>
              <div className="reset-actions">
                <button className="dialog-btn cancel" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </button>
                <button className="dialog-btn confirm" onClick={handleReset}>
                  Confirm Reset
                </button>
              </div>
            </div>
          ) : (
            <button className="reset-btn" onClick={() => setShowResetConfirm(true)}>
              Reset All Workspaces
            </button>
          )}
        </div>

        <div className="dialog-actions">
          <button className="dialog-btn cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Apply theme to document
export function applyTheme(themeKey: ThemeKey) {
  const theme = themes[themeKey]
  const root = document.documentElement
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  localStorage.setItem('app-theme', themeKey)
}

// Get saved theme
export function getSavedTheme(): ThemeKey {
  const saved = localStorage.getItem('app-theme')
  if (saved && saved in themes) {
    return saved as ThemeKey
  }
  return 'default'
}
