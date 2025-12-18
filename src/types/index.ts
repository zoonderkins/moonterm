// Workspace role with icon and color
export interface WorkspaceRole {
  id: string;
  name: string;
  icon: string;   // Emoji or text icon
  color: string;  // Hex color
}

// Predefined roles - differentiated from Tony's approach with icons + semantic meaning
export const WORKSPACE_ROLES: WorkspaceRole[] = [
  { id: 'frontend', name: 'Frontend', icon: '🎨', color: '#61dafb' },
  { id: 'backend', name: 'Backend', icon: '⚙️', color: '#68d391' },
  { id: 'devops', name: 'DevOps', icon: '🚀', color: '#f6ad55' },
  { id: 'api', name: 'API', icon: '🔌', color: '#a78bfa' },
  { id: 'mobile', name: 'Mobile', icon: '📱', color: '#f472b6' },
  { id: 'testing', name: 'Testing', icon: '🧪', color: '#fbbf24' },
  { id: 'docs', name: 'Docs', icon: '📚', color: '#60a5fa' },
  { id: 'infra', name: 'Infra', icon: '🏗️', color: '#9ca3af' },
];

export interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  createdAt: number;
  roleId?: string;  // Optional role ID from WORKSPACE_ROLES
  // Encryption support
  isLocked?: boolean;           // Whether workspace is currently locked
  encryptedData?: string;       // Encrypted workspace data (terminals, scrollback)
  passwordHint?: string;        // Optional hint for password recovery
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
}

export interface PtyOutput {
  id: string;
  data: string;
}

export interface PtyExit {
  id: string;
  exitCode: number;
}
