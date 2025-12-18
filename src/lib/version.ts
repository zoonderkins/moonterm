// App and storage schema versions
// Increment STORAGE_SCHEMA_VERSION when the saved data structure changes

export const APP_VERSION = '1.0.3'

// Storage schema versions
export const STORAGE_SCHEMA = {
  // Main workspace data (workspaces, terminals, scrollback)
  WORKSPACE: '1.0.0',
  // Session export format
  SESSION: '1.0.0',
  // Theme/settings stored in localStorage
  SETTINGS: '1.0.0',
}

// Combined version info for display
export function getVersionInfo() {
  return {
    app: APP_VERSION,
    schemas: {
      workspace: STORAGE_SCHEMA.WORKSPACE,
      session: STORAGE_SCHEMA.SESSION,
      settings: STORAGE_SCHEMA.SETTINGS,
    }
  }
}
