export interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  createdAt: number;
  // Encryption support
  isLocked?: boolean;           // Whether workspace is currently locked
  encryptedData?: string;       // Encrypted workspace data (terminals, scrollback)
  passwordHint?: string;        // Optional hint for password recovery
  // Environment variable support
  envVars?: Record<string, string>;           // Plain env vars (non-sensitive)
  encryptedEnvVars?: string;                  // Encrypted env vars (uses workspace password)
  autoLoadEnv?: boolean;                      // Auto-load .env from folderPath
  autoLoadDirenv?: boolean;                   // Auto-load .envrc from folderPath
}

// Environment variable entry for UI display
export interface EnvVarEntry {
  key: string;
  value: string;
  source: 'system' | 'workspace' | 'env_file' | 'direnv';
  isSecret?: boolean;           // If true, value is encrypted/masked
}

export interface TerminalInstance {
  id: string;
  workspaceId: string;
  title: string;
  pid?: number;
  cwd: string;
  scrollbackBuffer: string[];
  // Split support: ID of the terminal that this one is split from
  splitFromId?: string;
  // Saved scrollback content for restoration after app restart
  savedScrollbackContent?: string;
  // Activity tracking - updated on each output from PTY
  lastActivityTime?: number;
}

export type SplitDirection = 'horizontal' | 'vertical';
export type FocusedPane = 'main' | 'split';

export interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  focusedTerminalId: string | null;
  // Currently split terminal ID (if any)
  splitTerminalId: string | null;
  // Split direction: horizontal (top/bottom) or vertical (left/right)
  splitDirection: SplitDirection | null;
  // Which pane is focused (main or split)
  focusedPane: FocusedPane;
}

export interface CreatePtyOptions {
  id: string;
  cwd: string;
  customEnv?: Record<string, string>;  // Custom env vars to merge
}

// Result from reading env files
export interface EnvFilesInfo {
  hasEnv: boolean;
  hasEnvrc: boolean;
  envVars: Record<string, string>;
  envrcVars: Record<string, string>;
}

export interface PtyOutput {
  id: string;
  data: string;
}

export interface PtyExit {
  id: string;
  exitCode: number;
}
