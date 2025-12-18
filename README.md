# Moonterm

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.5-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-lightgrey.svg)
![Tauri](https://img.shields.io/badge/tauri-2.x-FFC131.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**A cross-platform terminal aggregator with multi-workspace support**

</div>

---

## Features

- **Multi-Workspace Support** - Organize terminals by project folders
- **Workspace Roles** - Color-coded project tags (Frontend, Backend, DevOps, etc.)
- **Activity Indicators** - Visual feedback showing active/idle terminals with breathing animation
- **Browser-Style Tabs** - Terminal tabs at top with hover preview
- **Terminal Split** - Split terminals horizontally (Cmd+D) or vertically (Cmd+Shift+D)
- **Split Pane Focus** - Click to switch focus between split panes (blue border indicates active)
- **Collapsible Sidebar** - Minimize to show workspace numbers only
- **Keyboard Shortcuts** - Quick switching with Ctrl+1-9, Cmd+T, Cmd+D
- **Theme Support** - 5 built-in color themes (Default Dark, Purple Night, Pink Blossom, Pure Black, Colorblind Safe)
- **Session Export/Import** - Save and restore workspace layouts and settings as JSON
- **Terminal History Persistence** - Scrollback history saved and restored across app restarts
- **Scroll History** - Terminal history preserved when switching tabs and workspaces
- **Nerd Font Support** - Powerlevel10k / Powerline compatible with Nerd Fonts
- **WebGL Rendering** - GPU-accelerated terminal rendering
- **Persistent Workspaces** - Saved across app restarts
- **Native Performance** - Rust-powered PTY backend with Tauri 2.x

---

## UI Layout

![UI Layout](docs/ui-layout.png)

## Installation

### macOS

1. Download `Moonterm_*_aarch64.dmg` from [Releases](https://github.com/zoonderkins/moonterm/releases)
2. Open the DMG
3. Drag "Moonterm" to Applications
4. Open from Applications (right-click → Open on first launch)

### Build from Source

```bash
# Prerequisites: Node.js 18+, Rust

# Clone and install
git clone https://github.com/zoonderkins/moonterm.git
cd moonterm
npm install

# Development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

---

## Quick Start

1. **Add Workspace** - Click "+" and select a project folder
2. **Use Terminal** - A terminal tab opens automatically
3. **Add More Tabs** - Press `Cmd+T` or click "+" in tab bar
4. **Split Terminal** - Press `Cmd+D` to split horizontally (press again to close)
5. **Switch Tabs** - Click tabs or use `Ctrl+Shift+1~9`
6. **Switch Workspaces** - Click sidebar or use `Ctrl+1~9`
7. **Collapse Sidebar** - Click "◀" to show only workspace numbers
8. **Rename** - Double-click any tab or workspace to rename

---

## Keyboard Shortcuts

### macOS

| Shortcut | Action |
|----------|--------|
| `Cmd+T` | New terminal tab |
| `Cmd+W` | Close current terminal tab |
| `Cmd+D` | Split terminal horizontally (top/bottom) |
| `Cmd+Shift+D` | Split terminal vertically (left/right) |
| `Cmd+↑` / `Cmd+↓` | Switch focus between top/bottom panes |
| `Cmd+←` / `Cmd+→` | Switch focus between left/right panes |
| `Cmd+1` ~ `Cmd+9` | Switch to terminal 1-9 |
| `Ctrl+1` ~ `Ctrl+9` | Switch to workspace 1-9 |
| Hold `Cmd` | Show shortcut hints |
| Double-click title | Rename terminal/workspace |

### Windows / Linux

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New terminal tab |
| `Ctrl+W` | Close current terminal tab |
| `Ctrl+D` | Split terminal horizontally (top/bottom) |
| `Ctrl+Shift+D` | Split terminal vertically (left/right) |
| `Ctrl+1` ~ `Ctrl+9` | Switch to workspace 1-9 |

> **Note**: On macOS, `Ctrl+C`, `Ctrl+W`, etc. are passed directly to the terminal (for shell commands like interrupt, delete word). Use `Cmd` for app shortcuts.

---

## Color Themes

Click the ⚙️ (Settings) button in the sidebar to change themes.

| Theme | Description |
|-------|-------------|
| **Default (Dark)** | Classic dark theme with blue accents |
| **Purple Night** | Deep purple tones with violet highlights |
| **Pink Blossom** | Warm dark theme with pink accents |
| **Pure Black** | OLED-friendly pure black theme |
| **Colorblind Safe** | Blue/orange theme designed for color vision deficiency |

Themes are saved to localStorage and persist across sessions.

---

## Session Export/Import

Click ⚙️ Settings → **Session** section to export or import session data.

### Export Session
- Saves workspace layout (names, folder paths)
- Saves all terminal tabs and their content snapshots
- Saves theme and split ratio settings
- Downloads as `moonterm-session-YYYY-MM-DD.json`

### Import Session
- Select a previously exported JSON file
- Restores theme and split ratio settings
- Reload app to apply imported settings

### Session JSON Schema (v1.0)

```json
{
  "version": "1.0",
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "appVersion": "1.0.0",
  "theme": "default",
  "splitRatio": 0.5,
  "workspaces": [
    {
      "id": "uuid-1",
      "name": "my-project",
      "folderPath": "/path/to/project",
      "terminals": [
        {
          "id": "term-1",
          "title": "Terminal 1",
          "cwd": "/path/to/project",
          "scrollbackContent": "$ npm run dev..."
        }
      ],
      "focusedTerminalId": "term-1"
    }
  ],
  "activeWorkspaceId": "uuid-1"
}
```

---

## Font Configuration

Moonterm supports Nerd Fonts for Powerline/Powerlevel10k compatibility. The font fallback order is:

```
MesloLGS NF → FiraCode Nerd Font → Hack Nerd Font → JetBrainsMono Nerd Font → Menlo → Monaco → Courier New
```

### Recommended Fonts

For Powerlevel10k users, install one of these Nerd Fonts:
- [MesloLGS NF](https://github.com/romkatv/powerlevel10k#fonts) (Recommended)
- [FiraCode Nerd Font](https://www.nerdfonts.com/font-downloads)
- [JetBrainsMono Nerd Font](https://www.nerdfonts.com/font-downloads)

> **Note**: Font ligatures (like `=>` becoming `⇒`) are not supported in terminal emulators due to fixed-width character grid requirements.

---

## Configuration

Config files location (Tauri app data directory):
- **macOS**: `~/Library/Application Support/dev.edoo.moonterm/`
- **Windows**: `%APPDATA%/dev.edoo.moonterm/`
- **Linux**: `~/.local/share/dev.edoo.moonterm/`

---

## Storage Schema Versions

Storage schema versions are displayed in Settings → About section. These versions help track data format compatibility.

| Schema | Version | Description |
|--------|---------|-------------|
| Workspace | 1.1.0 | Main data: workspaces, terminals, scrollback (gzip compressed) |
| Session | 1.0.0 | Export/import format |
| Settings | 1.0.0 | Theme and local settings |

### Workspace Data Format

The workspace data is saved to `workspaces.json.gz` (gzip compressed) in the config directory.
History versions are stored in the `history/` subdirectory (max 10 files).

```json
{
  "schemaVersion": "1.1.0",
  "savedAt": "2024-01-15T10:30:00.000Z",
  "workspaces": [...],
  "activeWorkspaceId": "uuid",
  "terminals": [
    {
      "id": "term-1",
      "workspaceId": "uuid",
      "title": "Terminal 1",
      "cwd": "/path/to/project",
      "scrollbackContent": "$ npm run dev..."
    }
  ],
  "focusedTerminalId": "term-1"
}
```

### Auto-Save Behavior

- **On exit**: Automatically saves before app closes
- **Periodic**: Saves every 30 seconds when terminals are open
- **On changes**: Saves when workspaces are added/removed/renamed

---

## Architecture

```
moonterm/
├── src/                      # React frontend
│   ├── components/           # UI components
│   ├── lib/                  # Utilities (tauri-bridge, pty-listeners)
│   ├── stores/               # State management
│   └── styles/               # CSS
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── lib.rs            # App entry
│   │   ├── commands.rs       # IPC handlers
│   │   ├── pty.rs            # PTY management
│   │   └── workspace.rs      # Persistence
│   └── tauri.conf.json
└── docs/                     # Documentation
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Runtime | Tauri 2.x |
| Frontend | React 19, TypeScript |
| Terminal | xterm.js 5.5 |
| PTY Backend | portable-pty (Rust) |
| Build | Vite, Cargo |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and component structure
- [Flow](docs/FLOW.md) - Application workflows and data flow
- [Development](docs/DEVELOPMENT.md) - Build, debug, and contribute

---

## Development

```bash
# Start development server
npm run tauri:dev

# Build release
npm run tauri:build

# Check Rust code
cd src-tauri && cargo check

# TypeScript check
npm run build
```

### Build Output

- **macOS App**: `src-tauri/target/release/bundle/macos/Moonterm.app`
- **macOS DMG**: `src-tauri/target/release/bundle/dmg/Moonterm_*.dmg`

---

## Troubleshooting

### Commands like `brew`, `node` not found?

The app should work with login shell by default. If issues persist, check that your `~/.zshrc` or `~/.zprofile` sets up PATH correctly.

### Terminal shows garbled characters?

The app sets `TERM=xterm-256color` automatically. If you see issues, ensure your shell prompt (like Powerlevel10k) is compatible.

---

## Technical Notes

### Unicode 11 Support

Moonterm includes `@xterm/addon-unicode11` for proper handling of:
- Emoji characters and sequences
- Wide characters (CJK, etc.)
- Special symbols and icons used by modern CLI tools

### TUI Application Compatibility

For applications using TUI frameworks (like **Claude Code CLI** which uses [Ink](https://github.com/vadimdemedes/ink) - React for CLI), Moonterm includes optimizations:

- **Larger PTY buffer** (16KB) to reduce ANSI escape sequence fragmentation
- **UTF-8 boundary detection** to prevent cutting multi-byte characters
- **convertEol** enabled for proper line ending handling
- **smoothScrollDuration: 0** for instant updates during rapid redraws

These optimizations help reduce visual glitches like extra blank lines during fast terminal updates.

### Large Paste Chunking

When pasting text larger than 2KB, Moonterm automatically chunks the data:

- **Rust-native chunking** - Handled in the PTY backend, not JavaScript
- **2KB chunks** with 10ms delays between them
- **Prevents terminal overwhelm** - Especially important for TUI apps like vim, nano
- **Transparent to users** - Single paste command, chunking is automatic

---

## License

MIT License
