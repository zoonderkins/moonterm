# Moonterm Enhancement TODO

> **Created**: 2026-01-21
> **Reference**: OpenCode TUI 架構分析

---

## 優先順序

| # | 功能 | 優先級 | 預估時間 | 狀態 |
|---|------|--------|----------|------|
| 1 | Toast 通知系統 | P0 (Critical) | 1h | ✅ Done |
| 2 | Session Import 完整恢復 | P0 (Critical) | 30m | ✅ Done |
| 3 | Workspace 命令歷史 | P1 (High) | 2h | ✅ Done |
| 4 | 收藏命令功能 | P1 (High) | 2h | ✅ Done |
| 5 | 主題 JSON 配置化 | P2 (Medium) | 3h | ✅ Done |
| 6 | Keybind 設定頁面 | P2 (Medium) | 2h | ✅ Done |

---

## 1. Toast 通知系統

### 描述
解決 `workspace-store.ts:574` 的 TODO，新增非阻塞式 Toast 通知組件。

### 檔案變更
- [ ] `src/components/Toast.tsx` - 新增 Toast 組件和 Context Provider
- [ ] `src/styles/main.css` - 新增 Toast 樣式
- [ ] `src/App.tsx` - 包裝 ToastProvider
- [ ] `src/stores/workspace-store.ts` - 整合 toast 通知

### Definition of Done
- [ ] Toast 組件支援 4 種類型: `info`, `success`, `warning`, `error`
- [ ] Toast 自動消失 (info: 3s, warning: 4s, error: 5s)
- [ ] Toast 可點擊手動關閉
- [ ] Toast 支援多個同時顯示 (堆疊)
- [ ] 進入/退出動畫流暢

### 驗收標準
- [ ] `npm run build` 無 TypeScript 錯誤
- [ ] `cd src-tauri && cargo check` 無 Rust 錯誤
- [ ] ESLint 無錯誤: `npm run lint` (若有配置)
- [ ] 手動測試: 儲存失敗時顯示 error toast
- [ ] 手動測試: workspace 操作成功時顯示 success toast

### 測試案例
```typescript
// Unit Test: Toast.test.tsx
describe('Toast', () => {
  it('should render toast with correct variant', () => {})
  it('should auto-dismiss after duration', () => {})
  it('should dismiss on click', () => {})
  it('should stack multiple toasts', () => {})
})

describe('useToast', () => {
  it('should provide show/success/error/warning/info methods', () => {})
  it('should throw if used outside ToastProvider', () => {})
})
```

---

## 2. Session Import 完整恢復

### 描述
修復 `session-manager.ts:93` 的限制，Import 時恢復 scrollback 內容。

### 檔案變更
- [ ] `src/lib/session-manager.ts` - 修改 importSession 函數

### Definition of Done
- [ ] Import session 時，scrollback 內容正確寫入 terminal
- [ ] 利用現有 `savedScrollbackContent` 機制

### 驗收標準
- [ ] `npm run build` 無 TypeScript 錯誤
- [ ] 手動測試: Export session → 關閉 app → Import session → scrollback 內容恢復

### 測試案例
```typescript
// Unit Test: session-manager.test.ts
describe('importSession', () => {
  it('should restore scrollback content from session file', () => {})
  it('should handle missing scrollback gracefully', () => {})
})
```

---

## 3. Workspace 命令歷史

### 描述
每個 workspace 記錄常用命令，提供 Cmd+R/Ctrl+R 快速重複執行。

### 檔案變更
- [x] `src/lib/command-history.ts` - 新增命令歷史管理
- [x] `src/components/CommandHistoryDialog.tsx` - 歷史選單 UI
- [x] `src/components/TerminalPanel.tsx` - Hook onData 捕捉命令
- [x] `src/App.tsx` - 添加 Cmd+R 快捷鍵
- [x] `src/styles/main.css` - 對話框樣式

### Definition of Done
- [x] 捕捉用戶輸入的命令 (Enter 鍵觸發)
- [x] 儲存到 localStorage (per workspace)
- [x] 最多保留 100 條歷史
- [x] Cmd+R (Mac) / Ctrl+R (Win/Linux) 開啟歷史對話框
- [x] 上下鍵選擇，Enter 執行
- [x] 支援模糊搜尋過濾

### 驗收標準
- [x] `npm run build` 無錯誤
- [ ] 手動測試: 輸入命令 → 按 Cmd+R → 顯示歷史 → 選擇執行

### 測試案例
```typescript
// Unit Test: command-history.test.ts
describe('CommandHistory', () => {
  it('should append command to history', () => {})
  it('should limit history to 100 entries', () => {})
  it('should persist to localStorage', () => {})
  it('should load from localStorage on init', () => {})
  it('should filter by fuzzy search', () => {})
})
```

---

## 4. 收藏命令功能

### 描述
將常用長命令加入收藏，一鍵執行。

### 檔案變更
- [x] `src/lib/command-bookmarks.ts` - 收藏管理
- [x] `src/components/BookmarksDialog.tsx` - 收藏 UI
- [x] `src/types/index.ts` - 新增 Bookmark 類型
- [x] `src/styles/main.css` - 樣式
- [x] `src/App.tsx` - 添加 Cmd+B 快捷鍵

### Definition of Done
- [x] 可從歷史或手動新增收藏
- [x] 支援 alias/備註
- [x] 支援編輯和刪除
- [x] Cmd+B (Mac) / Ctrl+B (Win/Linux) 開啟收藏選單

### 驗收標準
- [x] `npm run build` 無錯誤
- [ ] 手動測試: 新增收藏 → 執行 → 編輯 → 刪除

---

## 5. 主題 JSON 配置化

### 描述
參考 OpenCode catppuccin.json，將主題從 hardcoded CSS 改為 JSON 配置。

### 檔案變更
- [x] `src/themes/schema.ts` - 主題 JSON schema
- [x] `src/themes/default.json` - Default (Dark) 主題
- [x] `src/themes/purple.json` - Purple Night 主題
- [x] `src/themes/pink.json` - Pink Blossom 主題
- [x] `src/themes/black.json` - Pure Black 主題
- [x] `src/themes/colorblind.json` - Colorblind Safe 主題
- [x] `src/lib/theme-manager.ts` - 主題載入/應用
- [x] `src/components/SettingsDialog.tsx` - 支援導入自定義主題
- [x] `src/styles/main.css` - 添加 theme import/delete 樣式

### Definition of Done
- [x] 支援 JSON 格式主題定義
- [x] 支援 dark/light 變體
- [x] 用戶可導入自定義主題
- [x] 現有 5 個主題轉換為 JSON

### 驗收標準
- [x] `npm run build` 無錯誤
- [ ] 手動測試: 切換主題 → 導入自定義主題 → 主題正確應用

---

## 6. Keybind 設定頁面

### 描述
顯示所有快捷鍵，支援自定義。

### 檔案變更
- [x] `src/lib/keybind-manager.ts` - 快捷鍵配置管理
- [x] `src/components/KeybindSettings.tsx` - 設定 UI
- [x] `src/components/SettingsDialog.tsx` - 新增 Keybind 區塊
- [x] `src/styles/main.css` - 樣式

### Definition of Done
- [x] 列出所有快捷鍵及其功能
- [x] 支援修改快捷鍵
- [x] 偵測衝突並警告
- [x] 儲存到 localStorage

### 驗收標準
- [x] `npm run build` 無錯誤
- [ ] 手動測試: 修改快捷鍵 → 使用新快捷鍵 → 重啟後設定保留

---

## Regression Test Checklist

每次功能完成後，執行以下回歸測試：

### 核心功能
- [ ] 新增 Workspace
- [ ] 刪除 Workspace
- [ ] 新增 Terminal Tab (Cmd+T)
- [ ] 關閉 Terminal Tab (Cmd+W)
- [ ] 分割 Terminal (Cmd+D)
- [ ] 切換 Workspace (Ctrl+1~9)
- [ ] 切換 Tab (Cmd+1~9)

### Session 功能
- [ ] Export Session
- [ ] Import Session
- [ ] 關閉 App 後重開，狀態恢復

### 加密功能
- [ ] Lock Workspace
- [ ] Unlock Workspace
- [ ] 密碼錯誤提示

### Terminal 功能
- [ ] 複製 (Cmd+C)
- [ ] 貼上 (Cmd+V)
- [ ] 搜尋 (Cmd+F)
- [ ] 清除 (clear 或 context menu)
- [ ] Right-click context menu

### 設定功能
- [ ] 切換主題
- [ ] 修改字型
- [ ] 修改字型大小

---

## Build & Lint Commands

```bash
# TypeScript check
npm run build

# Rust check
cd src-tauri && cargo check

# ESLint (若有配置)
npm run lint

# 開發模式測試
npm run tauri:dev

# 生產構建
npm run tauri:build
```

---

## Notes

- 參考來源: [OpenCode TUI](https://github.com/anomalyco/opencode/tree/dev/packages/opencode/src/cli/cmd/tui)
- 主題 JSON 結構參考: `catppuccin.json` (defs + theme 結構)
- 命令歷史使用 JSONL 格式 (append-only)
- Toast 組件已部分實作: `src/components/Toast.tsx`
