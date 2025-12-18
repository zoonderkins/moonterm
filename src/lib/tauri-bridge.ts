import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import type { CreatePtyOptions } from '../types'

export interface TauriAPI {
  pty: {
    create: (options: CreatePtyOptions) => Promise<boolean>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<boolean>
    restart: (id: string, cwd: string) => Promise<boolean>
    getCwd: (id: string) => Promise<string | null>
    onOutput: (callback: (id: string, data: string) => void) => Promise<UnlistenFn>
    onExit: (callback: (id: string, exitCode: number) => void) => Promise<UnlistenFn>
  }
  workspace: {
    save: (data: string) => Promise<boolean>
    load: () => Promise<string | null>
    getConfigPath: () => Promise<string>
  }
  dialog: {
    selectFolder: () => Promise<string | null>
  }
  crypto: {
    encrypt: (plaintext: string, password: string, hint?: string) => Promise<string>
    decrypt: (encryptedData: string, password: string) => Promise<string>
    getHint: (encryptedData: string) => Promise<string | null>
  }
}

export const tauriAPI: TauriAPI = {
  pty: {
    create: (options: CreatePtyOptions) =>
      invoke<boolean>('pty_create', { options }),

    write: (id: string, data: string) =>
      invoke<void>('pty_write', { id, data }),

    resize: (id: string, cols: number, rows: number) =>
      invoke<void>('pty_resize', { id, cols: cols as number, rows: rows as number }),

    kill: (id: string) =>
      invoke<boolean>('pty_kill', { id }),

    restart: (id: string, cwd: string) =>
      invoke<boolean>('pty_restart', { id, cwd }),

    getCwd: (id: string) =>
      invoke<string | null>('pty_get_cwd', { id }),

    onOutput: async (callback: (id: string, data: string) => void): Promise<UnlistenFn> => {
      return listen<[string, string]>('pty:output', (event) => {
        const [id, data] = event.payload
        callback(id, data)
      })
    },

    onExit: async (callback: (id: string, exitCode: number) => void): Promise<UnlistenFn> => {
      return listen<[string, number]>('pty:exit', (event) => {
        const [id, exitCode] = event.payload
        callback(id, exitCode)
      })
    },
  },

  workspace: {
    save: (data: string) =>
      invoke<boolean>('workspace_save', { data }),

    load: () =>
      invoke<string | null>('workspace_load'),

    getConfigPath: () =>
      invoke<string>('get_config_path'),
  },

  dialog: {
    selectFolder: () =>
      invoke<string | null>('dialog_select_folder'),
  },

  crypto: {
    encrypt: (plaintext: string, password: string, hint?: string) =>
      invoke<string>('crypto_encrypt', { plaintext, password, hint }),

    decrypt: (encryptedData: string, password: string) =>
      invoke<string>('crypto_decrypt', { encryptedData, password }),

    getHint: (encryptedData: string) =>
      invoke<string | null>('crypto_get_hint', { encryptedData }),
  },
}

// Expose to window for backward compatibility
declare global {
  interface Window {
    tauriAPI: TauriAPI
  }
}

if (typeof window !== 'undefined') {
  window.tauriAPI = tauriAPI
}

export default tauriAPI
