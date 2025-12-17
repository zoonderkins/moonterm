mod commands;
mod pty;
mod workspace;

use pty::PtyManager;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let pty_manager = Arc::new(PtyManager::new(app_handle));
            app.manage(pty_manager);

            // DevTools can be opened via right-click context menu -> Inspect
            // Not opening automatically to keep UI clean
            let _ = app.get_webview_window("main"); // Keep reference for debugging if needed

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pty_create,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
            commands::pty_restart,
            commands::pty_get_cwd,
            commands::dialog_select_folder,
            commands::workspace_save,
            commands::workspace_load,
            commands::get_config_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
