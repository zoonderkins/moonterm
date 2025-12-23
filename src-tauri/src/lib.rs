mod commands;
mod crypto;
mod env;
mod pty;
mod workspace;

use pty::PtyManager;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let pty_manager = Arc::new(PtyManager::new(app_handle.clone()));
            app.manage(pty_manager);

            // Create Help menu with Quick Start item
            let quick_start = MenuItem::with_id(app, "quick_start", "Quick Start", true, None::<&str>)?;
            let help_menu = Submenu::with_items(app, "Help", true, &[&quick_start])?;

            // Get the default menu and append our Help menu
            let menu = Menu::with_items(app, &[&help_menu])?;
            app.set_menu(menu)?;

            // DevTools can be opened via right-click context menu -> Inspect
            // Not opening automatically to keep UI clean
            let _ = app.get_webview_window("main"); // Keep reference for debugging if needed

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "quick_start" {
                // Emit event to frontend to show Quick Start dialog
                let _ = app.emit("menu:quick-start", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            // PTY commands
            commands::pty_create,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
            commands::pty_restart,
            commands::pty_get_cwd,
            // Dialog commands
            commands::dialog_select_folder,
            // Workspace commands
            commands::workspace_save,
            commands::workspace_load,
            commands::get_config_path,
            // Crypto commands (password-only)
            commands::crypto_encrypt,
            commands::crypto_decrypt,
            commands::crypto_get_hint,
            // Environment variable commands
            commands::env_read_dotenv,
            commands::env_read_envrc,
            commands::env_has_dotenv,
            commands::env_has_envrc,
            commands::env_get_files_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
