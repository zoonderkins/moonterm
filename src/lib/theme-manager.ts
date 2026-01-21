/**
 * Theme Manager
 * Handles loading, storing, and applying themes
 */

import type { ValidatedTheme } from '../themes/schema'
import { validateTheme, CSS_VAR_MAP } from '../themes/schema'

// Import built-in themes
import defaultTheme from '../themes/default.json'
import purpleTheme from '../themes/purple.json'
import pinkTheme from '../themes/pink.json'
import blackTheme from '../themes/black.json'
import colorblindTheme from '../themes/colorblind.json'

const STORAGE_KEY_THEME = 'app-theme'
const STORAGE_KEY_CUSTOM_THEMES = 'custom-themes'

// Built-in themes (validated on load)
const builtInThemes: ValidatedTheme[] = [
  defaultTheme,
  purpleTheme,
  pinkTheme,
  blackTheme,
  colorblindTheme,
].map(t => validateTheme(t)).filter((t): t is ValidatedTheme => t !== null)

/**
 * Get all available themes (built-in + custom)
 */
export function getAllThemes(): ValidatedTheme[] {
  return [...builtInThemes, ...getCustomThemes()]
}

/**
 * Get built-in themes only
 */
export function getBuiltInThemes(): ValidatedTheme[] {
  return builtInThemes
}

/**
 * Get custom (user-imported) themes
 */
export function getCustomThemes(): ValidatedTheme[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CUSTOM_THEMES)
    if (!data) return []

    const parsed = JSON.parse(data) as unknown[]
    return parsed
      .map(t => validateTheme(t))
      .filter((t): t is ValidatedTheme => t !== null)
  } catch {
    return []
  }
}

/**
 * Save custom themes to localStorage
 */
function saveCustomThemes(themes: ValidatedTheme[]): void {
  localStorage.setItem(STORAGE_KEY_CUSTOM_THEMES, JSON.stringify(themes))
}

/**
 * Import a theme from JSON
 * Returns the validated theme if successful, null if invalid
 */
export function importTheme(json: string): ValidatedTheme | null {
  try {
    const parsed = JSON.parse(json)
    const validated = validateTheme(parsed)

    if (!validated) {
      console.error('[ThemeManager] Invalid theme format')
      return null
    }

    // Check if theme ID already exists
    const allThemes = getAllThemes()
    const existingIndex = allThemes.findIndex(t => t.id === validated.id)

    if (existingIndex >= 0) {
      // Check if it's a built-in theme
      if (builtInThemes.some(t => t.id === validated.id)) {
        console.error('[ThemeManager] Cannot override built-in theme')
        return null
      }

      // Update existing custom theme
      const customThemes = getCustomThemes()
      const customIndex = customThemes.findIndex(t => t.id === validated.id)
      if (customIndex >= 0) {
        customThemes[customIndex] = validated
        saveCustomThemes(customThemes)
        return validated
      }
    }

    // Add new custom theme
    const customThemes = getCustomThemes()
    customThemes.push(validated)
    saveCustomThemes(customThemes)

    return validated
  } catch (error) {
    console.error('[ThemeManager] Failed to import theme:', error)
    return null
  }
}

/**
 * Delete a custom theme
 */
export function deleteCustomTheme(themeId: string): boolean {
  // Cannot delete built-in themes
  if (builtInThemes.some(t => t.id === themeId)) {
    return false
  }

  const customThemes = getCustomThemes()
  const filtered = customThemes.filter(t => t.id !== themeId)

  if (filtered.length === customThemes.length) {
    return false
  }

  saveCustomThemes(filtered)
  return true
}

/**
 * Get a theme by ID
 */
export function getThemeById(id: string): ValidatedTheme | null {
  return getAllThemes().find(t => t.id === id) ?? null
}

/**
 * Get saved theme ID
 */
export function getSavedThemeId(): string {
  return localStorage.getItem(STORAGE_KEY_THEME) || 'default'
}

/**
 * Save theme preference
 */
export function saveThemeId(themeId: string): void {
  localStorage.setItem(STORAGE_KEY_THEME, themeId)
}

/**
 * Apply a theme to the document
 */
export function applyTheme(theme: ValidatedTheme): void {
  const root = document.documentElement

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const colorKey = key as keyof typeof theme.colors
    const value = theme.colors[colorKey]
    if (value) {
      root.style.setProperty(cssVar, value)
    }
  }

  // Set data attribute for variant (useful for CSS)
  root.setAttribute('data-theme-variant', theme.variant)
}

/**
 * Apply theme by ID
 */
export function applyThemeById(themeId: string): boolean {
  const theme = getThemeById(themeId)
  if (!theme) {
    // Fallback to default
    const defaultTheme = getThemeById('default')
    if (defaultTheme) {
      applyTheme(defaultTheme)
    }
    return false
  }

  applyTheme(theme)
  return true
}

/**
 * Initialize theme on app startup
 */
export function initializeTheme(): ValidatedTheme {
  const savedId = getSavedThemeId()
  const theme = getThemeById(savedId) || getThemeById('default')!

  applyTheme(theme)
  return theme
}

/**
 * Export a theme as JSON string
 */
export function exportTheme(themeId: string): string | null {
  const theme = getThemeById(themeId)
  if (!theme) return null

  return JSON.stringify(theme, null, 2)
}
