# Moonterm - Development Guide

## Prerequisites

- Node.js 18+
- Rust (latest stable)
- macOS: Xcode Command Line Tools
- Linux: `build-essential`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`
- Windows: Visual Studio Build Tools

## Setup

```bash
# Clone repository
git clone <repo-url>
cd better-agent-terminal

# Install dependencies
npm install

# Install Tauri CLI (if not installed)
npm install -g @tauri-apps/cli
```

## Development

### Start Dev Server

```bash
# Start both frontend and Tauri in development mode
npm run tauri:dev
```

This will:
1. Start Vite dev server on `http://localhost:1420`
2. Compile Rust backend
3. Open the app with hot-reload enabled

### Frontend Only

```bash
# Just run the Vite dev server (for UI development)
npm run dev
```

## Building

### Development Build

```bash
npm run tauri:build
```

Output locations:
- macOS App: `src-tauri/target/release/bundle/macos/Moonterm.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/Moonterm_*.dmg`

### Release Build

```bash
# Clean build
rm -rf src-tauri/target/release/bundle
npm run tauri:build
```

## Debugging

### Enable DevTools

DevTools are enabled by default in development. To enable in release builds:

1. The `devtools` feature is already configured in `src-tauri/Cargo.toml`:
   ```toml
   tauri = { version = "2", features = ["devtools"] }
   ```

2. DevTools auto-open is in `src-tauri/src/lib.rs`:
   ```rust
   #[cfg(feature = "devtools")]
   {
       if let Some(window) = app.get_webview_window("main") {
           window.open_devtools();
       }
   }
   ```

### Console Logging

**Frontend (JavaScript):**
```javascript
console.log('[Component] message')
```
View in DevTools Console.

**Backend (Rust):**
```rust
println!("message");
eprintln!("error message");
```
View in terminal where `npm run tauri:dev` is running.

### Common Issues

#### 1. TUI Applications (Claude Code CLI, etc.)

**Symptoms:** Extra blank lines, flickering, or garbled output when using CLI tools with rich UIs.

**Background:**
- **Claude Code CLI** uses [Ink](https://github.com/vadimdemedes/ink) (React for CLI) for rendering
- Ink generates intensive ANSI escape sequences for cursor movement (`ESC[nA`, `ESC[nB`), line clearing (`ESC[K`), and screen updates
- These TUI frameworks expect terminals to handle rapid redraws correctly

**Solutions implemented in Moonterm:**

1. **Larger PTY buffer (16KB)** - Reduces fragmentation of ANSI escape sequences
   ```rust
   // pty.rs
   let mut buf = [0u8; 16384];
   ```

2. **UTF-8 boundary detection** - Prevents cutting multi-byte characters mid-sequence
   ```rust
   let valid_len = find_utf8_boundary(&data_bytes);
   ```

3. **xterm.js options** - Optimized for TUI apps
   ```typescript
   convertEol: true,        // LF → CRLF conversion
   smoothScrollDuration: 0, // Instant updates
   ```

4. **Unicode 11 support** - Proper emoji and wide character handling
   ```typescript
   terminal.loadAddon(unicode11Addon)
   terminal.unicode.activeVersion = '11'
   ```

#### 2. Character Duplication in Terminal

**Cause:** Missing `TERM` environment variable.

**Solution:** Ensure `pty.rs` sets:
```rust
env_vars.insert("TERM".to_string(), "xterm-256color".to_string());
```

#### 3. PATH Not Loaded (brew, node, etc. not found)

**Cause:** App launched from Finder doesn't inherit shell PATH.

**Solution:** In `pty.rs`, spawn shell with `-l` flag:
```rust
(shell, vec!["-l".to_string()])
```

And add common paths:
```rust
#[cfg(target_os = "macos")]
{
    let homebrew_paths = vec![
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
    ];
    // Prepend to PATH
}
```

#### 4. Duplicate PTY Events

**Cause:** React component re-mounting creates multiple listeners.

**Solution:** Use global singleton pattern in `pty-listeners.ts`:
```typescript
let initialized = false
export async function initPtyListeners() {
  if (initialized) return
  initialized = true
  // Setup listeners once
}
```

#### 5. Zsh/Powerlevel10k Garbled Characters

**Symptoms:** Broken glyphs, incorrect character widths, or missing icons in Powerlevel10k prompt.

**Background:**
- Powerlevel10k uses special Unicode glyphs for icons (Git branch, folder icons, etc.)
- These require proper UTF-8 encoding and Nerd Font support
- ANSI escape sequences control cursor positioning based on character width

**Solutions implemented:**

1. **UTF-8 environment variables** - Ensures proper encoding
   ```rust
   // pty.rs
   env_vars.insert("LANG".to_string(), "en_US.UTF-8".to_string());
   env_vars.insert("LC_ALL".to_string(), "en_US.UTF-8".to_string());
   ```

2. **TERM variable** - Enables color and escape sequence support
   ```rust
   env_vars.insert("TERM".to_string(), "xterm-256color".to_string());
   env_vars.insert("COLORTERM".to_string(), "truecolor".to_string());
   ```

3. **Unicode 11 addon** - Correct character width calculation for wide chars
   ```typescript
   terminal.loadAddon(unicode11Addon)
   terminal.unicode.activeVersion = '11'
   ```

4. **Nerd Font fallback chain** - Ensures icons render correctly
   ```typescript
   fontFamily: '"MesloLGS NF", "FiraCode Nerd Font", "Hack Nerd Font", ...'
   ```

**User requirements:**
- Install a Nerd Font (e.g., [MesloLGS NF](https://github.com/romkatv/powerlevel10k#fonts))
- Run `p10k configure` after first launch if using Powerlevel10k

#### 6. DMG Missing App

**Cause:** Corrupted build cache.

**Solution:**
```bash
rm -rf src-tauri/target/release/bundle/dmg
npm run tauri:build
```

### Debugging PTY

Add logging to `pty.rs`:
```rust
println!("[PTY] Creating terminal: {}", options.id);
println!("[PTY] Shell: {}, CWD: {}", shell, options.cwd);
```

### Debugging Frontend State

Add to component:
```typescript
useEffect(() => {
  console.log('[Component] State changed:', state)
}, [state])
```

## Testing

### Manual Testing Checklist

- [ ] Create workspace
- [ ] Remove workspace
- [ ] Rename workspace (double-click)
- [ ] Create terminal
- [ ] Close terminal
- [ ] Rename terminal (double-click title)
- [ ] Switch terminals (click thumbnail)
- [ ] Switch terminals (Ctrl+Shift+1~9)
- [ ] Switch workspaces (Ctrl+1~9)
- [ ] Resize thumbnail bar (drag top edge)
- [ ] Restart terminal
- [ ] Change theme
- [ ] Verify PATH works (`which node`, `which brew`)
- [ ] Verify zsh plugins work (syntax highlighting, autosuggestions)

## Project Structure

```
src/                    # React frontend
src-tauri/              # Rust backend
docs/                   # Documentation
dist/                   # Vite build output (generated)
node_modules/           # NPM packages (generated)
src-tauri/target/       # Rust build output (generated)
```

## Useful Commands

```bash
# Check Rust compilation
cd src-tauri && cargo check

# Format Rust code
cd src-tauri && cargo fmt

# Lint Rust code
cd src-tauri && cargo clippy

# TypeScript check
npm run build  # tsc && vite build

# Clean all builds
rm -rf dist src-tauri/target
```
