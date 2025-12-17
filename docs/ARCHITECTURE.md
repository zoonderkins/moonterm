# Moonterm - Architecture

## Overview

Moonterm is a multi-workspace terminal aggregator built with Tauri 2.x, React, and xterm.js. It provides a unified interface for managing multiple terminal sessions across different project workspaces.

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Desktop Runtime | Tauri 2.x | 2.9.x |
| Frontend | React | 19.x |
| Terminal Emulator | xterm.js | 5.5.x |
| PTY Backend | portable-pty (Rust) | 0.8.x |
| Build Tool | Vite | 5.x |
| Language | TypeScript + Rust | - |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Window                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────────────────────────────────────┐   │
│  │ Sidebar │  │              WorkspaceView               │   │
│  │         │  │  ┌───────────────────────────────────┐  │   │
│  │ • WS 1  │  │  │         TerminalPanel             │  │   │
│  │ • WS 2  │  │  │         (xterm.js)                │  │   │
│  │ • WS 3  │  │  │                                   │  │   │
│  │         │  │  └───────────────────────────────────┘  │   │
│  │ Settings│  │  ┌───────────────────────────────────┐  │   │
│  │         │  │  │       ThumbnailBar (resizable)    │  │   │
│  └─────────┘  │  │  [Main] [Term 1] [Term 2] [+]     │  │   │
│               │  └───────────────────────────────────┘  │   │
│               └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Tauri IPC
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Rust Backend                            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   PtyManager    │  │ WorkspaceStore  │                   │
│  │                 │  │                 │                   │
│  │ • create()      │  │ • save()        │                   │
│  │ • write()       │  │ • load()        │                   │
│  │ • resize()      │  │                 │                   │
│  │ • kill()        │  └─────────────────┘                   │
│  │ • restart()     │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  portable-pty   │  ← Native PTY for macOS/Linux/Windows  │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
better-agent-terminal/
├── src/                      # React frontend
│   ├── components/           # React components
│   │   ├── Sidebar.tsx       # Workspace navigation
│   │   ├── WorkspaceView.tsx # Main terminal view
│   │   ├── TerminalPanel.tsx # xterm.js wrapper
│   │   ├── ThumbnailBar.tsx  # Terminal switcher
│   │   ├── TerminalThumbnail.tsx
│   │   ├── SettingsDialog.tsx
│   │   └── CloseConfirmDialog.tsx
│   ├── lib/                  # Utilities
│   │   ├── tauri-bridge.ts   # Tauri API wrapper
│   │   ├── pty-listeners.ts  # Global PTY event handlers
│   │   ├── session-manager.ts # Session export/import
│   │   └── terminal-registry.ts # Terminal instance registry for export
│   ├── stores/               # State management
│   │   └── workspace-store.ts
│   ├── styles/
│   │   └── main.css
│   ├── types.ts              # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── lib.rs            # Tauri app entry
│   │   ├── commands.rs       # IPC command handlers
│   │   ├── pty.rs            # PTY management
│   │   └── workspace.rs      # Workspace persistence
│   ├── icons/                # App icons
│   ├── Cargo.toml
│   └── tauri.conf.json       # Tauri configuration
├── docs/                     # Documentation
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Key Components

### Frontend (React)

#### WorkspaceStore
Central state management for workspaces and terminals. Uses a simple pub/sub pattern.

```typescript
interface AppState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  terminals: TerminalInstance[]
  focusedTerminalId: string | null
}
```

#### PTY Listeners
Global singleton that handles PTY events from Tauri backend. Prevents duplicate listeners during React re-renders.

```typescript
// Initialize once at app startup
initPtyListeners()

// Register/unregister per terminal
registerTerminal(id, onOutput, onExit)
unregisterTerminal(id)
```

### Backend (Rust)

#### PtyManager
Manages PTY instances using `portable-pty` crate.

- Creates PTY with proper environment (TERM, PATH, UTF-8)
- Handles input/output streaming via Tauri events
- Supports resize, restart, and kill operations

#### Environment Setup
Critical for proper shell behavior:

```rust
env_vars.insert("TERM", "xterm-256color");
env_vars.insert("COLORTERM", "truecolor");
// macOS: Add Homebrew paths
// Shell: Use -l flag for login shell
```

## Data Flow

### Terminal Input
```
User types → xterm.js onData → tauriAPI.pty.write →
Rust pty.write → PTY stdin → Shell
```

### Terminal Output
```
Shell → PTY stdout → Rust reader thread →
Tauri emit("pty:output") → pty-listeners.ts →
TerminalPanel → xterm.js write
```

### Workspace Persistence
```
User action → workspaceStore.save() →
tauriAPI.workspace.save() → Rust →
~/.config/better-agent-terminal/workspaces.json
```

## Session Export/Import

### Terminal Registry
Keeps references to xterm.js Terminal instances for content serialization.

```typescript
// Terminal registration (in TerminalPanel)
registerTerminalInstance(id, terminal, serializeAddon)

// Export terminal content
getTerminalContent(id) → string | null
getAllTerminalContents() → Map<string, string>
```

### Session Manager
Exports/imports session state as JSON.

```typescript
// Export session to downloadable file
downloadSessionFile() → downloads moonterm-session-YYYY-MM-DD.json

// Import session from file
importSession(file: File) → { success: boolean, message: string }
```

### Session Schema (v1.0)
```json
{
  "version": "1.0",
  "exportedAt": "ISO timestamp",
  "theme": "default",
  "splitRatio": 0.5,
  "workspaces": [
    {
      "id": "uuid",
      "name": "project-name",
      "folderPath": "/path/to/project",
      "terminals": [
        {
          "id": "term-id",
          "title": "Terminal 1",
          "scrollbackContent": "serialized terminal content"
        }
      ]
    }
  ]
}
```
