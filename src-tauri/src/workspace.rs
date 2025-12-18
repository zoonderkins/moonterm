use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::Manager;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use chrono::Utc;

const MAX_HISTORY_FILES: usize = 10;

/// Get the path to the workspace configuration file
pub fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    Ok(app_data_dir.join("workspaces.json.gz"))
}

/// Get the path to the history directory
fn get_history_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    Ok(app_data_dir.join("history"))
}

/// Rotate current workspace file to history
fn rotate_to_history(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let config_path = get_config_path(app_handle)?;

    // Only rotate if current file exists
    if !config_path.exists() {
        return Ok(());
    }

    let history_dir = get_history_dir(app_handle)?;

    // Create history directory if it doesn't exist
    fs::create_dir_all(&history_dir)
        .map_err(|e| format!("Failed to create history directory: {}", e))?;

    // Generate timestamp for history file
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let history_file = history_dir.join(format!("workspaces_{}.json.gz", timestamp));

    // Copy current file to history
    fs::copy(&config_path, &history_file)
        .map_err(|e| format!("Failed to copy to history: {}", e))?;

    // Clean up old history files (keep only MAX_HISTORY_FILES)
    cleanup_old_history(&history_dir)?;

    Ok(())
}

/// Clean up old history files, keeping only the most recent ones
fn cleanup_old_history(history_dir: &PathBuf) -> Result<(), String> {
    let mut entries: Vec<_> = fs::read_dir(history_dir)
        .map_err(|e| format!("Failed to read history dir: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .file_name()
                .map(|n| n.to_string_lossy().starts_with("workspaces_") && n.to_string_lossy().ends_with(".json.gz"))
                .unwrap_or(false)
        })
        .collect();

    // Sort by file name (which includes timestamp) in reverse order (newest first)
    entries.sort_by(|a, b| b.path().cmp(&a.path()));

    // Remove files beyond MAX_HISTORY_FILES
    for entry in entries.into_iter().skip(MAX_HISTORY_FILES) {
        if let Err(e) = fs::remove_file(entry.path()) {
            eprintln!("Failed to remove old history file: {}", e);
        }
    }

    Ok(())
}

/// Save workspace data to the config file (gzip compressed)
pub fn save_workspace(app_handle: &tauri::AppHandle, data: String) -> Result<bool, String> {
    let config_path = get_config_path(app_handle)?;

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Rotate current file to history before saving new one
    rotate_to_history(app_handle)?;

    // Compress and write
    let file = File::create(&config_path)
        .map_err(|e| format!("Failed to create config file: {}", e))?;
    let mut encoder = GzEncoder::new(file, Compression::default());
    encoder.write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write compressed data: {}", e))?;
    encoder.finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))?;

    Ok(true)
}

/// Load workspace data from the config file (gzip compressed)
pub fn load_workspace(app_handle: &tauri::AppHandle) -> Result<Option<String>, String> {
    let config_path = get_config_path(app_handle)?;

    if !config_path.exists() {
        // Try to load from legacy uncompressed file
        let legacy_path = config_path.with_extension("");
        let legacy_path = legacy_path.with_extension("json");
        if legacy_path.exists() {
            return fs::read_to_string(&legacy_path)
                .map(Some)
                .map_err(|e| format!("Failed to read legacy config: {}", e));
        }
        return Ok(None);
    }

    // Read and decompress
    let file = File::open(&config_path)
        .map_err(|e| format!("Failed to open config file: {}", e))?;
    let mut decoder = GzDecoder::new(file);
    let mut data = String::new();
    decoder.read_to_string(&mut data)
        .map_err(|e| format!("Failed to decompress data: {}", e))?;

    Ok(Some(data))
}
