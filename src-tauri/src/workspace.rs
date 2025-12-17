use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Get the path to the workspace configuration file
pub fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    Ok(app_data_dir.join("workspaces.json"))
}

/// Save workspace data to the config file
pub fn save_workspace(app_handle: &tauri::AppHandle, data: String) -> Result<bool, String> {
    let config_path = get_config_path(app_handle)?;

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    fs::write(&config_path, data).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(true)
}

/// Load workspace data from the config file
pub fn load_workspace(app_handle: &tauri::AppHandle) -> Result<Option<String>, String> {
    let config_path = get_config_path(app_handle)?;

    if !config_path.exists() {
        return Ok(None);
    }

    fs::read_to_string(&config_path)
        .map(Some)
        .map_err(|e| format!("Failed to read config: {}", e))
}
