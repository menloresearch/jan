//! Windows shell command processor for MCP
//! 
//! Provides comprehensive command processing logic equivalent to Node.js cross-spawn
//! for proper Windows shell handling with escaping, shebang detection, and cmd-shim support.

use std::path::Path;
use std::fs::File;
use std::io::{BufRead, BufReader};
use tokio::process::Command;

/// Check if command file is an executable (.com or .exe)
fn is_executable(command_file: &str) -> bool {
    let path = Path::new(command_file);
    if let Some(ext) = path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        ext_str == "com" || ext_str == "exe"
    } else {
        false
    }
}

/// Check if command file is a cmd-shim in node_modules/.bin/
fn is_cmd_shim(command_file: &str) -> bool {
    // Pattern: node_modules[\\/].bin[\\/][^\\/]+\.cmd$
    let normalized = command_file.replace('\\', "/");
    normalized.contains("node_modules/.bin/") && 
    Path::new(command_file).extension()
        .map(|ext| ext.to_string_lossy().to_lowercase() == "cmd")
        .unwrap_or(false)
}

/// Read shebang from file (first line starting with #!)
fn read_shebang(file_path: &str) -> Option<String> {
    if let Ok(file) = File::open(file_path) {
        let reader = BufReader::new(file);
        if let Some(Ok(first_line)) = reader.lines().next() {
            if first_line.starts_with("#!") {
                // Extract command from shebang, remove #! and trim
                let shebang = first_line[2..].trim();
                // Handle common shebangs like #!/usr/bin/env node
                if shebang.starts_with("/usr/bin/env ") {
                    return Some(shebang[13..].split_whitespace().next()?.to_string());
                } else {
                    return Some(shebang.split_whitespace().next()?.to_string());
                }
            }
        }
    }
    None
}

/// Detect shebang and update command if found
fn detect_shebang(command: &str, args: &mut Vec<String>) -> String {
    if let Some(shebang_cmd) = read_shebang(command) {
        // Insert original command as first argument
        args.insert(0, command.to_string());
        shebang_cmd
    } else {
        command.to_string()
    }
}

/// Escape command for cmd.exe
fn escape_command(command: &str) -> String {
    // Escape special characters: & | ( ) < > ^ "
    command.chars().map(|c| match c {
        '&' | '|' | '(' | ')' | '<' | '>' | '^' | '"' => format!("^{}", c),
        _ => c.to_string(),
    }).collect()
}

/// Escape argument for cmd.exe
fn escape_argument(arg: &str, double_escape_meta_chars: bool) -> String {
    let mut result = String::new();
    let needs_quotes = arg.contains(' ') || arg.contains('\t') || arg.contains('"') ||
                      arg.contains('&') || arg.contains('|') || arg.contains('<') ||
                      arg.contains('>') || arg.contains('^') || arg.contains('%');
    
    if needs_quotes {
        result.push('"');
    }
    
    for ch in arg.chars() {
        match ch {
            '"' => {
                // Escape quotes with backslash
                result.push('\\');
                result.push('"');
            }
            '&' | '|' | '(' | ')' | '<' | '>' | '^' | '%' => {
                if double_escape_meta_chars {
                    // Double escape for cmd-shims
                    result.push_str("^^");
                    result.push(ch);
                } else {
                    // Single escape
                    result.push('^');
                    result.push(ch);
                }
            }
            _ => result.push(ch),
        }
    }
    
    if needs_quotes {
        result.push('"');
    }
    
    result
}

/// Main shell processing logic for Windows (equivalent to Node.js parseNonShell)
pub fn parse_non_shell(
    mut command: String,
    mut args: Vec<String>,
    force_shell: bool,
) -> (String, Vec<String>) {
    // Detect shebang and update command if found
    let command_file = detect_shebang(&command, &mut args);
    
    // Check if we need a shell
    let needs_shell = force_shell || !is_executable(&command_file);
    
    if !needs_shell {
        // No shell needed, return as-is
        return (command_file, args);
    }
    
    // Need shell processing
    let needs_double_escape = is_cmd_shim(&command_file);
    
    // Normalize POSIX paths to Windows paths (foo/bar -> foo\bar)
    command = command.replace('/', "\\");
    
    // Escape command and arguments
    let escaped_command = escape_command(&command);
    let escaped_args: Vec<String> = args.iter()
        .map(|arg| escape_argument(arg, needs_double_escape))
        .collect();
    
    // Build shell command
    let mut shell_parts = vec![escaped_command];
    shell_parts.extend(escaped_args);
    let shell_command = shell_parts.join(" ");
    
    // Get COMSPEC or default to cmd.exe
    let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
    
    // Return cmd.exe with arguments: /d /s /c "command"
    let cmd_args = vec![
        "/d".to_string(),
        "/s".to_string(), 
        "/c".to_string(),
        format!("\"{}\"", shell_command),
    ];
    
    log::debug!("Windows shell processor: {} {}", comspec, cmd_args.join(" "));
    
    (comspec, cmd_args)
}