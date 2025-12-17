# Moonterm - 跨平台終端聚合程式

## 專案概述
一個跨平台終端聚合程式，支援多工作區管理，瀏覽器風格標籤頁，終端分割視圖。

## 技術選型
- **框架**: Tauri 2.x (Rust 後端)
- **前端**: React 19 + TypeScript
- **終端模擬**: xterm.js 5.5
- **PTY 後端**: portable-pty (Rust)
- **UI**: 純 CSS（深色主題）
- **持久化**: JSON 檔案（透過 Tauri API）

## 專案結構
```
moonterm/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx                  # React 入口
│   ├── App.tsx                   # 主應用元件（快捷鍵處理）
│   ├── types/
│   │   └── index.ts              # TypeScript 類型定義
│   ├── stores/
│   │   └── workspace-store.ts    # 工作區狀態管理（Pub/Sub 模式）
│   ├── lib/
│   │   ├── tauri-bridge.ts       # Tauri IPC 封裝
│   │   └── pty-listeners.ts      # PTY 事件監聽器
│   ├── components/
│   │   ├── Sidebar.tsx           # 可收合的工作區側邊欄
│   │   ├── WorkspaceView.tsx     # 工作區視圖（TabBar + 終端）
│   │   ├── TabBar.tsx            # 瀏覽器風格標籤列
│   │   ├── TerminalPanel.tsx     # xterm.js 終端面板
│   │   └── SettingsDialog.tsx    # 設定對話框（主題選擇）
│   └── styles/
│       └── main.css              # 主要樣式
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs               # Tauri 入口
│       ├── lib.rs                # Tauri 命令註冊
│       ├── commands.rs           # IPC 命令處理
│       ├── pty.rs                # PTY 管理器（portable-pty）
│       └── workspace.rs          # 工作區持久化
└── docs/
    ├── ARCHITECTURE.md
    ├── FLOW.md
    └── DEVELOPMENT.md
```

## 核心資料模型

```typescript
interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  createdAt: number;
}

interface TerminalInstance {
  id: string;
  workspaceId: string;
  title: string;
  pid?: number;
  cwd: string;
  scrollbackBuffer: string[];
  splitFromId?: string;  // 分割來源 terminal ID
}

type SplitDirection = 'horizontal' | 'vertical';

interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  focusedTerminalId: string | null;
  splitTerminalId: string | null;
  splitDirection: SplitDirection | null;
}
```

## IPC 通訊設計（Tauri Events）

### Rust → Frontend（Events）
- `pty:output` - 終端輸出資料 `[id, data]`
- `pty:exit` - 終端進程結束 `[id, exitCode]`

### Frontend → Rust（Commands）
- `pty_create` - 建立新 PTY
- `pty_write` - 寫入終端
- `pty_resize` - 調整終端大小
- `pty_kill` - 終止終端
- `pty_restart` - 重啟終端
- `pty_get_cwd` - 取得終端當前工作目錄
- `workspace_save` - 保存工作區設定
- `workspace_load` - 載入工作區設定
- `dialog_select_folder` - 選擇資料夾對話框
- `get_config_path` - 取得設定檔路徑

## 功能特性

### 已實作功能
- **多工作區支援** - 按資料夾組織終端
- **瀏覽器風格標籤頁** - 頂部標籤列，懸停預覽
- **終端分割** - 水平（上下）或垂直（左右）分割
- **分割焦點切換** - 點擊切換主/分割 pane 焦點，藍框指示
- **可收合側邊欄** - 收合時只顯示 1, 2, 3 數字
- **快捷鍵** - Mac: Cmd+T/W/D，Windows: Ctrl+T/W/D
- **主題支援** - 5 種顏色主題（Default Dark, Purple Night, Pink Blossom, Pure Black, Colorblind Safe）
- **Session Export/Import** - 匯出/匯入 workspace 配置和終端內容為 JSON
- **Scroll History** - 切換標籤頁和 Workspace 時保留歷史（所有 workspace 同時掛載）
- **自動關閉** - 終端退出後自動關閉 Tab
- **自動 Focus** - 切換 Tab 自動聚焦終端
- **Nerd Font 支援** - Powerlevel10k / Powerline 相容
- **WebGL 渲染** - GPU 加速終端渲染

### 快捷鍵（macOS）
| 快捷鍵 | 功能 |
|--------|------|
| `Cmd+T` | 新增終端 Tab |
| `Cmd+W` | 關閉當前 Tab |
| `Cmd+D` | 水平分割（上下） |
| `Cmd+Shift+D` | 垂直分割（左右） |
| `Cmd+↑/↓` | 切換上下分割焦點 |
| `Cmd+←/→` | 切換左右分割焦點 |
| `Cmd+1~9` | 切換終端 Tab |
| `Ctrl+1~9` | 切換 Workspace |
| 按住 `Cmd` | 顯示快捷鍵提示 |

## UI 佈局設計

```
┌─────────────────────────────────────────────────────────────┐
│  Moonterm                                                    │
├──────┬──────────────────────────────────────────────────────┤
│      │  [Terminal 1 ×] [Terminal 2 ×] [+]   ← 瀏覽器標籤   │
│  1   ├──────────────────────────────────────────────────────┤
│  2   │                                                      │
│  3   │         終端內容（主視窗）                            │
│      │                                                      │
│ ──── │  $ npm run dev                                       │
│  +   │  > vite                                              │
│  ⚙   │  Local: http://localhost:5173                        │
│      ├──────────────────────────────────────────────────────┤
│      │  ═══════════════════ ← 分割線（可拖曳調整）           │
│      ├──────────────────────────────────────────────────────┤
│      │         分割終端（底部/右側）                         │
│      │  $ git status                                        │
└──────┴──────────────────────────────────────────────────────┘
   ↑ 可收合側邊欄（收合時只顯示 1,2,3）
```

## 建置指令

```bash
# 開發模式
npm run tauri:dev

# 生產建置
npm run tauri:build

# 輸出
# - macOS: src-tauri/target/release/bundle/macos/Moonterm.app
# - DMG:   src-tauri/target/release/bundle/dmg/Moonterm_*.dmg
```

## 設定檔位置

Tauri app data directory:
- **macOS**: `~/Library/Application Support/dev.edoo.moonterm/`
- **Windows**: `%APPDATA%/dev.edoo.moonterm/`
- **Linux**: `~/.local/share/dev.edoo.moonterm/`

## 顏色主題

透過設定按鈕 (⚙️) 切換主題：

| 主題 | 說明 |
|------|------|
| Default (Dark) | 經典深色主題，藍色強調 |
| Purple Night | 深紫色調，紫羅蘭高亮 |
| Pink Blossom | 暖色深色主題，粉紅強調 |
| Pure Black | OLED 友好純黑主題 |
| Colorblind Safe | 色盲友好主題，藍/橙色設計 |

主題設定保存在 localStorage。

## 字體設定

支援 Nerd Font 以相容 Powerlevel10k/Powerline：

```
字體優先順序:
MesloLGS NF → FiraCode Nerd Font → Hack Nerd Font → JetBrainsMono Nerd Font → Menlo → Monaco → Courier New
```

### 終端渲染

- **渲染引擎**: xterm.js + WebGL Addon（GPU 加速）
- **字體抗鋸齒**: 由瀏覽器/OS 原生處理
- **UTF-8 Emoji**: 完整支援
- **Powerline 符號**: 需要安裝 Nerd Font
- **字體連字**: 不支援（終端模擬器技術限制）

## Session Export/Import

透過設定按鈕 (⚙️) → Session 區塊匯出/匯入。

### 功能說明

- **Export Session** - 下載 JSON 檔案，包含 workspace 配置、主題、終端內容快照
- **Import Session** - 匯入 JSON 檔案，恢復主題和設定

### Session Schema v1.0

```typescript
interface SessionData {
  version: '1.0'
  exportedAt: string           // ISO timestamp
  appVersion: string
  theme: string                // 主題 key
  splitRatio: number           // 分割比例
  workspaces: SessionWorkspace[]
  activeWorkspaceId?: string
}

interface SessionWorkspace {
  id: string
  name: string
  folderPath: string
  terminals: SessionTerminal[]
  focusedTerminalId?: string
}

interface SessionTerminal {
  id: string
  title: string
  cwd: string
  scrollbackContent?: string   // xterm.js serialize addon 格式
}
```

### 相關檔案

- `src/types/session.ts` - Schema 定義
- `src/lib/session-manager.ts` - 匯出/匯入邏輯
- `src/lib/terminal-registry.ts` - 終端實例註冊（用於匯出內容）
