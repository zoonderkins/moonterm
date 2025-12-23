use crate::crypto;
use crate::env;
use crate::pty::{CreatePtyOptions, PtyManager};
use crate::workspace;
use std::collections::HashMap;
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

// ============================================================================
// Encryption Commands
// ============================================================================

/// Encrypt data with password
#[tauri::command]
pub async fn crypto_encrypt(
    plaintext: String,
    password: String,
    hint: Option<String>,
) -> Result<String, String> {
    let envelope = crypto::encrypt(&plaintext, &password, hint)?;
    crypto::envelope_to_string(&envelope)
}

/// Decrypt data with password
#[tauri::command]
pub async fn crypto_decrypt(encrypted_data: String, password: String) -> Result<String, String> {
    let envelope = crypto::string_to_envelope(&encrypted_data)?;
    crypto::decrypt(&envelope, &password)
}

/// Get password hint from encrypted data
#[tauri::command]
pub async fn crypto_get_hint(encrypted_data: String) -> Result<Option<String>, String> {
    let envelope = crypto::string_to_envelope(&encrypted_data)?;
    Ok(envelope.hint)
}

// ============================================================================
// Environment Variable Commands
// ============================================================================

/// Read .env file from a directory
#[tauri::command]
pub async fn env_read_dotenv(dir_path: String) -> Result<HashMap<String, String>, String> {
    let result = env::read_env_file(&dir_path);
    if !result.errors.is_empty() {
        eprintln!("Errors reading .env: {:?}", result.errors);
    }
    Ok(result.env_vars)
}

/// Read .envrc file from a directory (direnv format)
#[tauri::command]
pub async fn env_read_envrc(dir_path: String) -> Result<HashMap<String, String>, String> {
    let result = env::read_envrc_file(&dir_path);
    if !result.errors.is_empty() {
        eprintln!("Errors reading .envrc: {:?}", result.errors);
    }
    Ok(result.env_vars)
}

/// Check if .env file exists in directory
#[tauri::command]
pub async fn env_has_dotenv(dir_path: String) -> Result<bool, String> {
    Ok(env::has_env_file(&dir_path))
}

/// Check if .envrc file exists in directory
#[tauri::command]
pub async fn env_has_envrc(dir_path: String) -> Result<bool, String> {
    Ok(env::has_envrc_file(&dir_path))
}

/// Get all env files info for a directory
#[tauri::command]
pub async fn env_get_files_info(
    dir_path: String,
) -> Result<(bool, bool, HashMap<String, String>, HashMap<String, String>), String> {
    let has_env = env::has_env_file(&dir_path);
    let has_envrc = env::has_envrc_file(&dir_path);

    let env_vars = if has_env {
        env::read_env_file(&dir_path).env_vars
    } else {
        HashMap::new()
    };

    let envrc_vars = if has_envrc {
        env::read_envrc_file(&dir_path).env_vars
    } else {
        HashMap::new()
    };

    Ok((has_env, has_envrc, env_vars, envrc_vars))
}
