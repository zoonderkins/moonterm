# Moonterm - Application Flow

## Startup Flow

```
1. App Launch
   │
   ├─► main.tsx
   │   └─► ReactDOM.createRoot().render(<App />)
   │
   ├─► App.tsx
   │   ├─► initPtyListeners()  // Global PTY event listeners
   │   ├─► workspaceStore.load()  // Load saved workspaces
   │   └─► Apply saved theme
   │
   └─► Rust Backend (lib.rs)
       ├─► PtyManager::new()
       └─► Open DevTools (if devtools feature enabled)
```

## Workspace Creation Flow

```
User clicks "+ Add Workspace"
   │
   ├─► tauriAPI.dialog.selectFolder()
   │   └─► Native folder picker dialog
   │
   ├─► workspaceStore.addWorkspace(name, path)
   │   └─► Generate UUID, add to state
   │
   └─► workspaceStore.save()
       └─► Save to ~/.config/better-agent-terminal/workspaces.json
```

## Terminal Creation Flow

```
User opens workspace or clicks "+ New Terminal"
   │
   ├─► workspaceStore.addTerminal(workspaceId)
   │   └─► Generate UUID, add to state
   │
   └─► tauriAPI.pty.create({ id, cwd })
       │
       └─► Rust: PtyManager::create()
           ├─► portable_pty::native_pty_system().openpty()
           ├─► Set environment (TERM, PATH, UTF-8)
           ├─► Spawn shell with -l flag (login shell)
           ├─► Start reader thread → emit("pty:output")
           └─► Start exit monitor thread → emit("pty:exit")
```

## Terminal I/O Flow

### Input (User → Shell)

```
User types in xterm.js
   │
   ├─► terminal.onData(data)
   │   └─► tauriAPI.pty.write(terminalId, data)
   │       │
   │       └─► Rust: pty_write command
   │           └─► instance.writer.write_all(data)
   │               └─► PTY stdin → Shell receives input
```

### Output (Shell → User)

```
Shell produces output
   │
   ├─► PTY stdout
   │   └─► Rust reader thread (loop)
   │       └─► buf_reader.read(&mut buf)
   │           └─► app_handle.emit("pty:output", (id, data))
   │               │
   │               └─► Frontend: pty-listeners.ts
   │                   └─► onOutput callback
   │                       └─► terminal.write(data)
   │                           └─► xterm.js renders output
```

## Terminal Switching Flow

```
User clicks thumbnail OR presses Ctrl+Shift+N
   │
   ├─► workspaceStore.setFocusedTerminal(id)
   │
   ├─► WorkspaceView re-renders
   │   ├─► mainTerminal = focusedTerminal
   │   └─► thumbnailTerminals = all except focused
   │
   └─► TerminalPanel
       └─► Only active terminal is rendered (prevents duplicate events)
```

## Terminal Resize Flow

```
Window/container resized
   │
   ├─► ResizeObserver callback
   │   ├─► fitAddon.fit()  // xterm.js recalculates size
   │   └─► tauriAPI.pty.resize(id, cols, rows)
   │       │
   │       └─► Rust: pty_resize command
   │           └─► master.resize(PtySize { rows, cols })
```

## Terminal Restart Flow

```
User clicks restart button
   │
   ├─► handleRestart(id)
   │   ├─► Get current cwd from PTY
   │   ├─► Dispatch 'terminal:restart' event (clears xterm)
   │   └─► tauriAPI.pty.restart(id, cwd)
   │       │
   │       └─► Rust: pty_restart
   │           ├─► PtyManager::kill(id)  // Close existing
   │           └─► PtyManager::create(id, cwd)  // Create new
   │
   └─► Trigger resize after 100ms
```

## Workspace Removal Flow

```
User clicks remove workspace
   │
   ├─► workspaceStore.removeWorkspace(id)
   │   ├─► Filter out terminals for this workspace
   │   ├─► Kill all associated PTYs
   │   └─► Update activeWorkspaceId if needed
   │
   └─► workspaceStore.save()
```

## Theme Change Flow

```
User selects theme in Settings
   │
   ├─► onThemeChange(themeKey)
   │   ├─► setCurrentTheme(themeKey)
   │   └─► applyTheme(themeKey)
   │       ├─► Update CSS variables on :root
   │       └─► localStorage.setItem('theme', themeKey)
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+1~9 | Switch workspace |
| Ctrl+Shift+1~9 | Switch terminal within workspace |

```
keydown event
   │
   ├─► Ctrl pressed → Show shortcut hints
   │
   ├─► Ctrl+N → workspaceStore.setActiveWorkspace(workspaces[N-1])
   │
   └─► Ctrl+Shift+N → workspaceStore.setFocusedTerminal(terminals[N-1])
```
