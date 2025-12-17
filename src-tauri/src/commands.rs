use crate::pty::{CreatePtyOptions, PtyManager};
use crate::workspace;
use std::sync::Arc;
use tauri::State;

/// Create a new PTY instance
#[tauri::command]
pub async fn pty_create(
    pty_manager: State<'_, Arc<PtyManager>>,
    options: CreatePtyOptions,
) -> Result<bool, String> {
    pty_manager.create(options)
}

/// Write data to a PTY instance
#[tauri::command]
pub async fn pty_write(
    pty_manager: State<'_, Arc<PtyManager>>,
    id: String,
    data: String,
) -> Result<(), String> {
    pty_manager.write(id, data)
}

/// Resize a PTY instance
#[tauri::command]
pub async fn pty_resize(
    pty_manager: State<'_, Arc<PtyManager>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty_manager.resize(id, cols, rows)
}

/// Kill a PTY instance
#[tauri::command]
pub async fn pty_kill(pty_manager: State<'_, Arc<PtyManager>>, id: String) -> Result<bool, String> {
    pty_manager.kill(id)
}

/// Restart a PTY instance with a new working directory
#[tauri::command]
pub async fn pty_restart(
    pty_manager: State<'_, Arc<PtyManager>>,
    id: String,
    cwd: String,
) -> Result<bool, String> {
    pty_manager.restart(id, cwd)
}

/// Get the current working directory of a PTY instance
#[tauri::command]
pub async fn pty_get_cwd(
    pty_manager: State<'_, Arc<PtyManager>>,
    id: String,
) -> Result<Option<String>, String> {
    pty_manager.get_cwd(id)
}

/// Open a folder selection dialog
#[tauri::command]
pub async fn dialog_select_folder(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let result = app_handle
        .dialog()
        .file()
        .blocking_pick_folder();

    Ok(result.map(|path| path.to_string()))
}

/// Save workspace data
#[tauri::command]
pub async fn workspace_save(app_handle: tauri::AppHandle, data: String) -> Result<bool, String> {
    workspace::save_workspace(&app_handle, data)
}

/// Load workspace data
#[tauri::command]
pub async fn workspace_load(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    workspace::load_workspace(&app_handle)
}

/// Get the config file path
#[tauri::command]
pub async fn get_config_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    workspace::get_config_path(&app_handle).map(|p| p.to_string_lossy().to_string())
}
