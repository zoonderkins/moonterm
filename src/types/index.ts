export interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  createdAt: number;
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
