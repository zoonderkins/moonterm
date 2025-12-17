use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePtyOptions {
    pub id: String,
    pub cwd: String,
}

struct PtyInstance {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    cwd: String,
    uses_pty: bool,
    // Keep these alive to prevent PTY from closing
    #[allow(dead_code)]
    master: Option<Arc<Mutex<Box<dyn MasterPty + Send>>>>,
    #[allow(dead_code)]
    child_handle: Option<Arc<Mutex<Child>>>,
}

pub struct PtyManager {
    instances: Arc<Mutex<HashMap<String, PtyInstance>>>,
    app_handle: AppHandle,
}

impl PtyManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    /// Detect the default shell for the current platform
    fn get_default_shell() -> (String, Vec<String>) {
        #[cfg(target_os = "windows")]
        {
            (
                "powershell.exe".to_string(),
                vec![
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                    "-NoLogo".to_string(),
                ],
            )
        }

        #[cfg(target_os = "macos")]
        {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            // Use -l (login) to load .zprofile/.zshrc for proper PATH setup
            // This ensures mise, homebrew, nvm, etc. paths are loaded
            (shell, vec!["-l".to_string()])
        }

        #[cfg(target_os = "linux")]
        {
            let shell = std::env::var("SHELL")
                .or_else(|_| {
                    if std::path::Path::new("/bin/bash").exists() {
                        Ok("/bin/bash".to_string())
                    } else {
                        Ok("/bin/sh".to_string())
                    }
                })
                .unwrap();
            (shell, vec![])
        }
    }

    /// Create UTF-8 environment variables with proper terminal settings
    fn create_utf8_env() -> HashMap<String, String> {
        let mut env_vars: HashMap<String, String> = std::env::vars().collect();

        // CRITICAL: Set TERM for proper terminal emulation
        // Without this, zsh plugins (syntax-highlighting, autosuggestions, powerlevel10k)
        // don't know how to use cursor movement sequences and output raw characters
        env_vars.insert("TERM".to_string(), "xterm-256color".to_string());
        env_vars.insert("COLORTERM".to_string(), "truecolor".to_string());

        // Add Homebrew paths to PATH (not inherited when launched from Finder)
        #[cfg(target_os = "macos")]
        {
            let current_path = env_vars.get("PATH").cloned().unwrap_or_default();
            let homebrew_paths = vec![
                "/opt/homebrew/bin",      // Apple Silicon
                "/opt/homebrew/sbin",
                "/usr/local/bin",         // Intel Mac
                "/usr/local/sbin",
            ];
            let mut new_path = homebrew_paths.join(":");
            if !current_path.is_empty() {
                new_path.push(':');
                new_path.push_str(&current_path);
            }
            env_vars.insert("PATH".to_string(), new_path);
        }

        // UTF-8 encoding
        env_vars.insert("LANG".to_string(), "en_US.UTF-8".to_string());
        env_vars.insert("LC_ALL".to_string(), "en_US.UTF-8".to_string());
        env_vars.insert("PYTHONIOENCODING".to_string(), "utf-8".to_string());
        env_vars.insert("PYTHONUTF8".to_string(), "1".to_string());

        env_vars
    }

    /// Create a new PTY instance
    pub fn create(&self, options: CreatePtyOptions) -> Result<bool, String> {
        let (shell, args) = Self::get_default_shell();
        let env_vars = Self::create_utf8_env();

        // Use portable-pty only - no fallback to avoid duplicate output issues
        self.create_with_portable_pty(&options, &shell, &args, &env_vars)?;
        println!("Created terminal using portable-pty");
        Ok(true)
    }

    fn create_with_portable_pty(
        &self,
        options: &CreatePtyOptions,
        shell: &str,
        args: &[String],
        env_vars: &HashMap<String, String>,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 30,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open pty: {}", e))?;

        let mut cmd = CommandBuilder::new(shell);
        cmd.args(args);
        cmd.cwd(&options.cwd);

        for (key, value) in env_vars {
            cmd.env(key, value);
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        // Get reader from master BEFORE taking writer
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        // Get writer from master
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let writer_arc = Arc::new(Mutex::new(writer as Box<dyn Write + Send>));

        // IMPORTANT: Keep master alive to prevent pty from closing
        let master_arc = Arc::new(Mutex::new(pair.master));

        // Spawn reader thread
        let id = options.id.clone();
        let app_handle = self.app_handle.clone();

        thread::spawn(move || {
            let mut buf_reader = BufReader::new(reader);
            let mut buf = [0u8; 4096];

            loop {
                match buf_reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle.emit("pty:output", (&id, &data));
                    }
                    Err(e) => {
                        eprintln!("Read error: {}", e);
                        break;
                    }
                }
            }
        });

        // Spawn exit monitor thread
        let id_exit = options.id.clone();
        let app_handle_exit = self.app_handle.clone();
        let instances = self.instances.clone();

        thread::spawn(move || {
            let exit_status = child.wait();
            let exit_code = match exit_status {
                Ok(status) => status.exit_code(),
                Err(_) => 1,
            };

            let _ = app_handle_exit.emit("pty:exit", (&id_exit, exit_code));
            instances.lock().remove(&id_exit);
        });

        self.instances.lock().insert(
            options.id.clone(),
            PtyInstance {
                writer: writer_arc,
                cwd: options.cwd.clone(),
                uses_pty: true,
                master: Some(master_arc), // Store master to keep it alive
                child_handle: None,
            },
        );

        Ok(())
    }

    #[allow(dead_code)]
    fn create_with_fallback(
        &self,
        options: &CreatePtyOptions,
        shell: &str,
        args: &[String],
        env_vars: &HashMap<String, String>,
    ) -> Result<(), String> {
        let mut cmd = Command::new(shell);
        cmd.args(args);
        cmd.current_dir(&options.cwd);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        for (key, value) in env_vars {
            cmd.env(key, value);
        }

        // For PowerShell, add UTF-8 encoding command
        #[cfg(target_os = "windows")]
        if shell.contains("powershell") {
            cmd.args(&[
                "-NoExit",
                "-Command",
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
                 [Console]::InputEncoding = [System.Text.Encoding]::UTF8; \
                 $OutputEncoding = [System.Text.Encoding]::UTF8",
            ]);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        // Take stdin
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to take stdin".to_string())?;

        // Create writer wrapper for stdin
        struct StdinWriter(std::process::ChildStdin);
        impl Write for StdinWriter {
            fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
                self.0.write(buf)
            }
            fn flush(&mut self) -> std::io::Result<()> {
                self.0.flush()
            }
        }
        // Make StdinWriter Send
        unsafe impl Send for StdinWriter {}

        let writer_arc = Arc::new(Mutex::new(Box::new(StdinWriter(stdin)) as Box<dyn Write + Send>));

        // Capture stdout
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to take stdout".to_string())?;
        let id_stdout = options.id.clone();
        let app_handle_stdout = self.app_handle.clone();

        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut buf = [0u8; 4096];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle_stdout.emit("pty:output", (&id_stdout, &data));
                    }
                    Err(_) => break,
                }
            }
        });

        // Capture stderr
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to take stderr".to_string())?;
        let id_stderr = options.id.clone();
        let app_handle_stderr = self.app_handle.clone();

        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buf = [0u8; 4096];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle_stderr.emit("pty:output", (&id_stderr, &data));
                    }
                    Err(_) => break,
                }
            }
        });

        // Send initial message
        let _ = self.app_handle.emit(
            "pty:output",
            (&options.id, "[Terminal - fallback mode]\r\n"),
        );

        let child_arc = Arc::new(Mutex::new(child));

        // Spawn exit monitor
        let id_exit = options.id.clone();
        let app_handle_exit = self.app_handle.clone();
        let instances = self.instances.clone();
        let child_clone = child_arc.clone();

        thread::spawn(move || {
            let exit_code = child_clone
                .lock()
                .wait()
                .map(|status| status.code().unwrap_or(1))
                .unwrap_or(1);

            let _ = app_handle_exit.emit("pty:exit", (&id_exit, exit_code));
            instances.lock().remove(&id_exit);
        });

        self.instances.lock().insert(
            options.id.clone(),
            PtyInstance {
                writer: writer_arc,
                cwd: options.cwd.clone(),
                uses_pty: false,
                master: None,
                child_handle: Some(child_arc),
            },
        );

        println!("Created terminal using child_process fallback");
        Ok(())
    }

    /// Write data to PTY
    pub fn write(&self, id: String, data: String) -> Result<(), String> {
        let instances = self.instances.lock();
        let instance = instances
            .get(&id)
            .ok_or_else(|| "PTY instance not found".to_string())?;

        let mut writer_lock = instance.writer.lock();
        writer_lock
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write: {}", e))?;
        writer_lock
            .flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;

        Ok(())
    }

    /// Resize PTY (only works with portable-pty, ignored for fallback)
    pub fn resize(&self, id: String, cols: u16, rows: u16) -> Result<(), String> {
        let instances = self.instances.lock();
        let instance = instances.get(&id);

        if let Some(inst) = instance {
            if inst.uses_pty {
                if let Some(ref master) = inst.master {
                    let master_lock = master.lock();
                    let _ = master_lock.resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
            }
        }

        Ok(())
    }

    /// Kill PTY instance
    pub fn kill(&self, id: String) -> Result<bool, String> {
        let mut instances = self.instances.lock();

        if let Some(instance) = instances.remove(&id) {
            if let Some(child_handle) = instance.child_handle {
                let _ = child_handle.lock().kill();
            }
            // For PTY, dropping the master will close the connection
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Restart PTY instance
    pub fn restart(&self, id: String, cwd: String) -> Result<bool, String> {
        // Check if instance exists
        {
            let instances = self.instances.lock();
            if !instances.contains_key(&id) {
                return Err("PTY instance not found".to_string());
            }
        }

        self.kill(id.clone())?;

        self.create(CreatePtyOptions { id, cwd })
    }

    /// Get current working directory
    pub fn get_cwd(&self, id: String) -> Result<Option<String>, String> {
        let instances = self.instances.lock();
        Ok(instances.get(&id).map(|inst| inst.cwd.clone()))
    }
}
