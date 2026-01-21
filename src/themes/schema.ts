/**
 * Theme JSON Schema
 * Defines the structure for theme configuration files
 */

// Theme color definitions
export interface ThemeColors {
  // Background colors
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgHover: string

  // Text colors
  textPrimary: string
  textSecondary: string

  // UI colors
  borderColor: string
  accentColor: string

  // Terminal specific
  terminalBg: string

  // Optional: danger color (defaults to #ef4444)
  dangerColor?: string

  // Optional: success color (defaults to #22c55e)
  successColor?: string

  // Optional: warning color (defaults to #f59e0b)
  warningColor?: string
}

// Full theme definition
export interface ThemeDefinition {
  // Unique identifier (used for storage)
  id: string

  // Display name
  name: string

  // Theme variant
  variant: 'dark' | 'light'

  // Author information (optional)
  author?: string

  // Theme colors
  colors: ThemeColors

  // Reference definitions (optional, for catppuccin-style reusable values)
  defs?: Record<string, string>
}

// Validated theme with all required fields
export interface ValidatedTheme extends ThemeDefinition {
  colors: Required<ThemeColors>
}

// CSS variable mapping
export const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgTertiary: '--bg-tertiary',
  bgHover: '--bg-hover',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  borderColor: '--border-color',
  accentColor: '--accent-color',
  terminalBg: '--terminal-bg',
  dangerColor: '--danger-color',
  successColor: '--success-color',
  warningColor: '--warning-color',
}

// Default values for optional colors
export const DEFAULT_OPTIONAL_COLORS = {
  dangerColor: '#ef4444',
  successColor: '#22c55e',
  warningColor: '#f59e0b',
} as const

/**
 * Validate and normalize a theme definition
 */
export function validateTheme(theme: unknown): ValidatedTheme | null {
  if (!theme || typeof theme !== 'object') return null

  const t = theme as Record<string, unknown>

  // Required fields
  if (typeof t.id !== 'string' || !t.id) return null
  if (typeof t.name !== 'string' || !t.name) return null
  if (t.variant !== 'dark' && t.variant !== 'light') return null
  if (!t.colors || typeof t.colors !== 'object') return null

  const colors = t.colors as Record<string, unknown>

  // Required color fields
  const requiredColors = [
    'bgPrimary', 'bgSecondary', 'bgTertiary', 'bgHover',
    'textPrimary', 'textSecondary',
    'borderColor', 'accentColor', 'terminalBg'
  ]

  for (const key of requiredColors) {
    if (typeof colors[key] !== 'string' || !colors[key]) {
      console.warn(`[Theme] Missing required color: ${key}`)
      return null
    }
  }

  // Resolve $ref references if defs are provided
  const defs = (t.defs && typeof t.defs === 'object') ? t.defs as Record<string, string> : {}
  const resolvedColors: Record<string, string> = {}

  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      resolvedColors[key] = resolveRef(value, defs)
    }
  }

  return {
    id: t.id as string,
    name: t.name as string,
    variant: t.variant as 'dark' | 'light',
    author: typeof t.author === 'string' ? t.author : undefined,
    defs: Object.keys(defs).length > 0 ? defs : undefined,
    colors: {
      bgPrimary: resolvedColors.bgPrimary,
      bgSecondary: resolvedColors.bgSecondary,
      bgTertiary: resolvedColors.bgTertiary,
      bgHover: resolvedColors.bgHover,
      textPrimary: resolvedColors.textPrimary,
      textSecondary: resolvedColors.textSecondary,
      borderColor: resolvedColors.borderColor,
      accentColor: resolvedColors.accentColor,
      terminalBg: resolvedColors.terminalBg,
      dangerColor: resolvedColors.dangerColor || DEFAULT_OPTIONAL_COLORS.dangerColor,
      successColor: resolvedColors.successColor || DEFAULT_OPTIONAL_COLORS.successColor,
      warningColor: resolvedColors.warningColor || DEFAULT_OPTIONAL_COLORS.warningColor,
    }
  }
}

/**
 * Resolve $ref references in color values
 * Example: "$base" -> "#1e1e2e" (from defs)
 */
function resolveRef(value: string, defs: Record<string, string>): string {
  if (value.startsWith('$')) {
    const refKey = value.slice(1)
    return defs[refKey] || value
  }
  return value
}
