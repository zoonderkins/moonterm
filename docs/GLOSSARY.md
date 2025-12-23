# Moonterm - Technical Glossary

This document explains technical terms used in Moonterm's codebase and documentation.

---

## Terminal & Process Terms

### PTY (Pseudo-Terminal)
A software abstraction that emulates a hardware terminal. PTY provides a bidirectional communication channel between the terminal emulator (Moonterm) and shell processes (zsh, bash). Moonterm uses the `portable-pty` Rust crate for cross-platform PTY management.

### Shell
A command-line interpreter (e.g., zsh, bash, PowerShell) that executes commands. Moonterm spawns a shell process inside a PTY for each terminal tab.

### TERM
An environment variable that tells programs what terminal capabilities are available. Moonterm sets `TERM=xterm-256color` for 256-color support.

### COLORTERM
Environment variable indicating color depth. `truecolor` means 24-bit color (16.7 million colors).

### ANSI Escape Sequences
Special character sequences that control terminal formatting (colors, cursor position, text styles). Example: `\x1b[31m` sets text color to red.

### CRLF (Carriage Return Line Feed)
Line ending format. CR (`\r`) moves cursor to start of line, LF (`\n`) moves to next line. Some programs send only LF, but terminals expect CRLF. Moonterm's `convertEol` option handles this automatically.

---

## Application Architecture Terms

### IPC (Inter-Process Communication)
Communication between the Rust backend and React frontend. Moonterm uses Tauri's `invoke()` for calling Rust functions from JavaScript and `emit()` for sending events back.

```
Frontend (React)                  Backend (Rust)
    |                                  |
    |--- invoke("pty_create") -------->|
    |                                  |
    |<----- emit("pty:output") --------|
```

### Tauri
Cross-platform desktop application framework. Combines a Rust backend with a web-based frontend (React/Vue/etc.). More secure and smaller than Electron.

### WebGL
Graphics API for GPU-accelerated rendering in browsers. Moonterm uses `@xterm/addon-webgl` for smooth terminal rendering.

---

## Security Terms

### AES-256-GCM
Advanced Encryption Standard with 256-bit key and Galois/Counter Mode. Industry-standard authenticated encryption used for workspace locking.

### Argon2id
Memory-hard password hashing algorithm. Combines Argon2i (side-channel resistance) and Argon2d (GPU resistance). Used to derive encryption keys from passwords.

### Salt
Random data added to password before hashing. Prevents rainbow table attacks. Moonterm generates a unique salt for each encrypted workspace.

---

## Environment Variable Terms

### .env File
A file containing environment variables in `KEY=value` format. Commonly used for storing configuration and secrets.

### direnv / .envrc
A shell extension that automatically loads environment variables when entering a directory. The `.envrc` file contains shell commands (typically `export KEY=value`).

### Sandboxed Environment
Each workspace runs in isolation with its own:
- Working directory (`folderPath`)
- Environment variables (`envVars`)
- Encrypted secrets (`encryptedEnvVars`)
- Auto-loaded `.env` / `.envrc` files

---

## UI Terms

### xterm.js
Terminal emulator library for web browsers. Renders terminal output using canvas/WebGL.

### Nerd Fonts
Patched fonts with extra icons/glyphs for terminal tools like Powerline and Powerlevel10k.

### Split Pane
Dividing a terminal into two regions (horizontal or vertical) showing different content.

---

## Data Storage Terms

### localStorage
Browser storage API for persisting data between sessions. Moonterm stores theme, sidebar state, and panel sizes here.

### Gzip Compression
Data compression algorithm. Workspace data is stored as `workspaces.json.gz` to reduce file size.

### Schema Version
Version number tracking data format changes. Helps with backward compatibility when updating storage formats.

---

## Development Terms

### Hot Reload
Automatic page refresh when source code changes during development. Provided by Vite.

### Cargo
Rust's package manager and build system. Similar to npm for JavaScript.

### TypeScript
Typed superset of JavaScript. Adds static type checking for better code quality.
