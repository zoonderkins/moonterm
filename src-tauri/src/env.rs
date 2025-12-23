use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Result of parsing environment files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvParseResult {
    pub env_vars: HashMap<String, String>,
    pub source: String,
    pub errors: Vec<String>,
}

/// Parse a .env file and return key-value pairs
/// Supports:
/// - KEY=value
/// - KEY="quoted value"
/// - KEY='single quoted'
/// - # comments
/// - Empty lines (ignored)
pub fn parse_env_file(content: &str) -> HashMap<String, String> {
    let mut result = HashMap::new();

    for line in content.lines() {
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Find the first = sign
        if let Some(eq_pos) = line.find('=') {
            let key = line[..eq_pos].trim().to_string();
            let mut value = line[eq_pos + 1..].trim().to_string();

            // Handle quoted values
            if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                if value.len() >= 2 {
                    value = value[1..value.len() - 1].to_string();
                }
            }

            // Handle escape sequences in double-quoted strings
            if value.contains("\\n") {
                value = value.replace("\\n", "\n");
            }
            if value.contains("\\t") {
                value = value.replace("\\t", "\t");
            }

            if !key.is_empty() {
                result.insert(key, value);
            }
        }
    }

    result
}

/// Read and parse .env file from a directory
pub fn read_env_file(dir_path: &str) -> EnvParseResult {
    let env_path = Path::new(dir_path).join(".env");

    if !env_path.exists() {
        return EnvParseResult {
            env_vars: HashMap::new(),
            source: ".env".to_string(),
            errors: vec![],
        };
    }

    match fs::read_to_string(&env_path) {
        Ok(content) => EnvParseResult {
            env_vars: parse_env_file(&content),
            source: ".env".to_string(),
            errors: vec![],
        },
        Err(e) => EnvParseResult {
            env_vars: HashMap::new(),
            source: ".env".to_string(),
            errors: vec![format!("Failed to read .env: {}", e)],
        },
    }
}

/// Read and parse .envrc file from a directory (direnv format)
/// Note: We only parse simple export KEY=value statements
/// Full direnv functionality (source_env, use nix, etc.) is not supported
pub fn read_envrc_file(dir_path: &str) -> EnvParseResult {
    let envrc_path = Path::new(dir_path).join(".envrc");

    if !envrc_path.exists() {
        return EnvParseResult {
            env_vars: HashMap::new(),
            source: ".envrc".to_string(),
            errors: vec![],
        };
    }

    match fs::read_to_string(&envrc_path) {
        Ok(content) => {
            let mut result = HashMap::new();
            let mut errors = Vec::new();

            for line in content.lines() {
                let line = line.trim();

                // Skip empty lines and comments
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }

                // Handle "export KEY=value" format
                if let Some(rest) = line.strip_prefix("export ") {
                    if let Some(eq_pos) = rest.find('=') {
                        let key = rest[..eq_pos].trim().to_string();
                        let mut value = rest[eq_pos + 1..].trim().to_string();

                        // Handle quoted values
                        if (value.starts_with('"') && value.ends_with('"'))
                            || (value.starts_with('\'') && value.ends_with('\''))
                        {
                            if value.len() >= 2 {
                                value = value[1..value.len() - 1].to_string();
                            }
                        }

                        if !key.is_empty() {
                            result.insert(key, value);
                        }
                    }
                } else if line.contains("source_env") || line.contains("use ") {
                    // Unsupported direnv features
                    errors.push(format!("Unsupported direnv directive: {}", line));
                }
            }

            EnvParseResult {
                env_vars: result,
                source: ".envrc".to_string(),
                errors,
            }
        }
        Err(e) => EnvParseResult {
            env_vars: HashMap::new(),
            source: ".envrc".to_string(),
            errors: vec![format!("Failed to read .envrc: {}", e)],
        },
    }
}

/// Check if .env file exists in directory
pub fn has_env_file(dir_path: &str) -> bool {
    Path::new(dir_path).join(".env").exists()
}

/// Check if .envrc file exists in directory
pub fn has_envrc_file(dir_path: &str) -> bool {
    Path::new(dir_path).join(".envrc").exists()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_env_file() {
        let content = r#"
# Comment line
KEY1=value1
KEY2="quoted value"
KEY3='single quoted'
EMPTY=
WITH_SPACES = spaced value
"#;
        let result = parse_env_file(content);
        assert_eq!(result.get("KEY1"), Some(&"value1".to_string()));
        assert_eq!(result.get("KEY2"), Some(&"quoted value".to_string()));
        assert_eq!(result.get("KEY3"), Some(&"single quoted".to_string()));
        assert_eq!(result.get("EMPTY"), Some(&"".to_string()));
    }
}
