import { useState, useEffect, useRef } from 'react'
import { tauriAPI } from '../lib/tauri-bridge'
import { workspaceStore } from '../stores/workspace-store'
import { downloadSessionFile, importSession } from '../lib/session-manager'
import { STORAGE_SCHEMA } from '../lib/version'
import {
  getAllThemes,
  getThemeById,
  getSavedThemeId,
  saveThemeId,
  applyTheme as applyThemeToDocument,
  importTheme,
  deleteCustomTheme,
  getBuiltInThemes,
} from '../lib/theme-manager'
import type { ValidatedTheme } from '../themes/schema'
import { KeybindSettings } from './KeybindSettings'

// Font options for terminal (use Mono variants for proper terminal rendering)
export const fontOptions = [
  { value: '"MesloLGS NF", "MesloLGS Nerd Font Mono", monospace', label: 'MesloLGS NF (Recommended)' },
  { value: '"Hack Nerd Font Mono", monospace', label: 'Hack Nerd Font Mono' },
  { value: '"FiraCode Nerd Font Mono", monospace', label: 'FiraCode Nerd Font Mono' },
  { value: '"JetBrainsMono Nerd Font Mono", monospace', label: 'JetBrains Mono Nerd Font' },
  { value: 'Menlo, Monaco, "Courier New", monospace', label: 'System Default' },
]

// Icon font options (for Nerd Font icons fallback)
export const iconFontOptions = [
  { value: '', label: 'None (use main font)' },
  { value: '"MesloLGS NF", "MesloLGS Nerd Font Mono"', label: 'MesloLGS NF' },
  { value: '"Hack Nerd Font Mono"', label: 'Hack Nerd Font Mono' },
  { value: '"FiraCode Nerd Font Mono"', label: 'FiraCode Nerd Font Mono' },
  { value: '"JetBrainsMono Nerd Font Mono"', label: 'JetBrains Mono Nerd Font' },
  { value: '"Symbols Nerd Font Mono"', label: 'Symbols Nerd Font (icons only)' },
]

export interface FontSettings {
  fontFamily: string
  fontSize: number
  ligatures: boolean
  iconFont: string  // Additional font for Nerd Font icons (appended to fontFamily)
}

const DEFAULT_FONT_SETTINGS: FontSettings = {
  fontFamily: '"MesloLGS NF", "MesloLGS Nerd Font Mono", "Hack Nerd Font Mono", "FiraCode Nerd Font Mono", "JetBrainsMono Nerd Font Mono", Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  ligatures: false,
  iconFont: '',
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

// Compute the effective font-family string (with icon font fallback if set)
export function getEffectiveFontFamily(settings: FontSettings): string {
  if (settings.iconFont) {
    // Remove 'monospace' from main font, add icon font, then add monospace at the end
    const mainFont = settings.fontFamily.replace(/, ?monospace$/, '')
    return `${mainFont}, ${settings.iconFont}, monospace`
  }
  return settings.fontFamily
}

// ThemeKey is now a string (theme ID)
export type ThemeKey = string

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
  const themeInputRef = useRef<HTMLInputElement>(null)
  const [fontSettings, setFontSettings] = useState<FontSettings>(getSavedFontSettings)
  const [themes, setThemes] = useState<ValidatedTheme[]>([])
  const [themeImportStatus, setThemeImportStatus] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      tauriAPI.workspace.getConfigPath().then(setConfigPath).catch(() => {})
      setImportStatus(null) // Clear status when dialog opens
      setThemeImportStatus(null)
      setFontSettings(getSavedFontSettings()) // Reload font settings
      setThemes(getAllThemes()) // Load themes
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

  const handleLigaturesChange = (enabled: boolean) => {
    const newSettings = { ...fontSettings, ligatures: enabled }
    setFontSettings(newSettings)
    saveFontSettings(newSettings)
  }

  const handleIconFontChange = (value: string) => {
    const newSettings = { ...fontSettings, iconFont: value }
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

  const handleThemeImportClick = () => {
    themeInputRef.current?.click()
  }

  const handleThemeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const theme = importTheme(content)

      if (theme) {
        setThemeImportStatus({ success: true, message: `Imported theme: ${theme.name}` })
        setThemes(getAllThemes())
        // Auto-apply imported theme
        onThemeChange(theme.id)
      } else {
        setThemeImportStatus({ success: false, message: 'Invalid theme format' })
      }
    } catch {
      setThemeImportStatus({ success: false, message: 'Failed to read theme file' })
    }

    if (themeInputRef.current) {
      themeInputRef.current.value = ''
    }
  }

  const handleDeleteTheme = (themeId: string) => {
    if (confirm('Delete this custom theme?')) {
      deleteCustomTheme(themeId)
      setThemes(getAllThemes())
      // If deleted theme was active, switch to default
      if (currentTheme === themeId) {
        onThemeChange('default')
      }
    }
  }

  const builtInIds = new Set(getBuiltInThemes().map(t => t.id))

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        {/* Theme Selection */}
        <div className="settings-section">
          <div className="settings-label-row">
            <label className="settings-label">Theme</label>
            <button className="theme-import-btn" onClick={handleThemeImportClick}>
              + Import
            </button>
            <input
              ref={themeInputRef}
              type="file"
              accept=".json"
              onChange={handleThemeFileChange}
              style={{ display: 'none' }}
            />
          </div>
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
                onClick={() => onThemeChange(theme.id)}
                style={{
                  backgroundColor: theme.colors.bgPrimary,
                  borderColor: currentTheme === theme.id ? theme.colors.accentColor : theme.colors.borderColor,
                }}
              >
                <span
                  className="theme-accent"
                  style={{ backgroundColor: theme.colors.accentColor }}
                />
                <span className="theme-name" style={{ color: theme.colors.textPrimary }}>
                  {theme.name}
                </span>
                {!builtInIds.has(theme.id) && (
                  <span
                    className="theme-delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteTheme(theme.id) }}
                    title="Delete theme"
                  >
                    ✕
                  </span>
                )}
              </button>
            ))}
          </div>
          {themeImportStatus && (
            <div className={`import-status ${themeImportStatus.success ? 'success' : 'error'}`}>
              {themeImportStatus.message}
            </div>
          )}
          <p className="settings-hint">
            Import custom themes from JSON files. See documentation for format.
          </p>
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
            <div className="font-setting-row">
              <label>Icon Font (fallback)</label>
              <select
                className="font-select"
                value={fontSettings.iconFont}
                onChange={(e) => handleIconFontChange(e.target.value)}
              >
                {iconFontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="font-setting-row checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={fontSettings.ligatures}
                  onChange={(e) => handleLigaturesChange(e.target.checked)}
                />
                Use ligatures
              </label>
              <span className="setting-hint">Enable font ligatures (e.g., =&gt; becomes ⇒)</span>
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

        {/* Keyboard Shortcuts */}
        <div className="settings-section">
          <label className="settings-label">Keyboard Shortcuts</label>
          <KeybindSettings />
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
  const theme = getThemeById(themeKey)
  if (theme) {
    applyThemeToDocument(theme)
    saveThemeId(themeKey)
  } else {
    // Fallback to default
    const defaultTheme = getThemeById('default')
    if (defaultTheme) {
      applyThemeToDocument(defaultTheme)
      saveThemeId('default')
    }
  }
}

// Get saved theme
export function getSavedTheme(): ThemeKey {
  return getSavedThemeId()
}
