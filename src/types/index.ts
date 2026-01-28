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

// Tree-based split layout for supporting nested splits (4-pane, etc.)
export type SplitNode = 
  | { type: 'terminal'; terminalId: string }
  | { type: 'split'; direction: SplitDirection; first: SplitNode; second: SplitNode; ratio: number };

export interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  focusedTerminalId: string | null;
  // Tree-based split layout per workspace (keyed by terminalId of the "root" terminal)
  // When a terminal is split, its layout is stored here
  splitLayouts: Record<string, SplitNode>;
  // Legacy fields (kept for backward compatibility, will be migrated)
  splitTerminalId: string | null;
  splitDirection: SplitDirection | null;
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

// Command bookmark for quick access to frequently used commands
export interface CommandBookmark {
  id: string;
  command: string;
  alias?: string;           // Short name for quick reference
  description?: string;     // User note about what this command does
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
}
