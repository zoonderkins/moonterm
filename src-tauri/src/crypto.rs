//! Workspace encryption module
//!
//! Provides AES-256-GCM encryption with Argon2id key derivation.
//! On macOS, supports Touch ID authentication via Keychain.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHasher,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};

/// Encrypted data envelope containing all info needed for decryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedEnvelope {
    /// Base64-encoded encrypted data
    pub ciphertext: String,
    /// Base64-encoded nonce (12 bytes for AES-GCM)
    pub nonce: String,
    /// Base64-encoded salt for Argon2
    pub salt: String,
    /// Optional password hint
    pub hint: Option<String>,
    /// Version for future compatibility
    pub version: u8,
}

/// Derive a 256-bit key from password using Argon2id
fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let argon2 = Argon2::default();

    // Create salt string from bytes
    let salt_string = SaltString::encode_b64(salt).map_err(|e| format!("Salt error: {}", e))?;

    // Hash password
    let hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| format!("Hash error: {}", e))?;

    // Extract 32 bytes from hash output
    let hash_bytes = hash.hash.ok_or("No hash output")?;
    let bytes = hash_bytes.as_bytes();

    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes[..32.min(bytes.len())]);

    // Pad if needed (shouldn't happen with Argon2)
    if bytes.len() < 32 {
        return Err("Hash output too short".to_string());
    }

    Ok(key)
}

/// Encrypt plaintext with password
pub fn encrypt(plaintext: &str, password: &str, hint: Option<String>) -> Result<EncryptedEnvelope, String> {
    // Generate random salt (16 bytes)
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    // Derive key from password
    let key = derive_key(password, &salt)?;

    // Generate random nonce (12 bytes for AES-GCM)
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Create cipher and encrypt
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher error: {}", e))?;
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    Ok(EncryptedEnvelope {
        ciphertext: BASE64.encode(&ciphertext),
        nonce: BASE64.encode(&nonce_bytes),
        salt: BASE64.encode(&salt),
        hint,
        version: 1,
    })
}

/// Decrypt ciphertext with password
pub fn decrypt(envelope: &EncryptedEnvelope, password: &str) -> Result<String, String> {
    // Decode base64 components
    let ciphertext = BASE64
        .decode(&envelope.ciphertext)
        .map_err(|e| format!("Ciphertext decode error: {}", e))?;
    let nonce_bytes = BASE64
        .decode(&envelope.nonce)
        .map_err(|e| format!("Nonce decode error: {}", e))?;
    let salt = BASE64
        .decode(&envelope.salt)
        .map_err(|e| format!("Salt decode error: {}", e))?;

    // Derive key from password
    let key = derive_key(password, &salt)?;

    // Create cipher and decrypt
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher error: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Decryption failed - wrong password or corrupted data".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode error: {}", e))
}

/// Serialize envelope to JSON string
pub fn envelope_to_string(envelope: &EncryptedEnvelope) -> Result<String, String> {
    serde_json::to_string(envelope).map_err(|e| format!("Serialize error: {}", e))
}

/// Deserialize envelope from JSON string
pub fn string_to_envelope(data: &str) -> Result<EncryptedEnvelope, String> {
    serde_json::from_str(data).map_err(|e| format!("Deserialize error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = "Hello, World! 你好世界";
        let password = "test_password_123";

        let envelope = encrypt(plaintext, password, Some("Test hint".to_string())).unwrap();
        let decrypted = decrypt(&envelope, password).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_wrong_password() {
        let plaintext = "Secret data";
        let password = "correct_password";
        let wrong_password = "wrong_password";

        let envelope = encrypt(plaintext, password, None).unwrap();
        let result = decrypt(&envelope, wrong_password);

        assert!(result.is_err());
    }
}
