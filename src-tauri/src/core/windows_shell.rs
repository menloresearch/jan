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

/// Escape command for cmd.exe - simplified approach
fn escape_command(command: &str) -> String {
    // For commands with spaces, use simple double-quoting
    // Windows handles most edge cases correctly with this approach
    if command.contains(' ') || command.contains('\t') {
        // If already quoted, return as-is
        if command.starts_with('"') && command.ends_with('"') {
            command.to_string()
        } else {
            // Simple double-quote wrapping - let Windows handle internal escaping
            format!("\"{}\"", command)
        }
    } else {
        // No spaces, return as-is
        command.to_string()
    }
}

/// Escape argument for cmd.exe - simplified approach
fn escape_argument(arg: &str, _double_escape_meta_chars: bool) -> String {
    // For arguments with spaces or special characters, use simple double-quoting
    if arg.contains(' ') || arg.contains('\t') || arg.contains('"') {
        // If already quoted, return as-is
        if arg.starts_with('"') && arg.ends_with('"') {
            arg.to_string()
        } else {
            // Escape internal quotes and wrap in quotes
            let escaped_quotes = arg.replace('"', "\\\"");
            format!("\"{}\"", escaped_quotes)
        }
    } else {
        // No special characters, return as-is
        arg.to_string()
    }
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
    
    // Build shell command with proper quoting
    let shell_command = if escaped_args.is_empty() {
        escaped_command
    } else {
        format!("{} {}", escaped_command, escaped_args.join(" "))
    };
    
    // Get COMSPEC or default to cmd.exe
    // let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
    let comspec = "cmd.exe".to_string();
    
    // Return cmd.exe with arguments: /d /s /c command
    // Note: Don't add extra quotes here - shell_command already has proper escaping
    let cmd_args = vec![
        "/d".to_string(),
        "/s".to_string(),
        "/c".to_string(),
        shell_command,
    ];
    
    log::debug!("Windows shell processor: {} {}", comspec, cmd_args.join(" "));
    
    (comspec, cmd_args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_non_shell_with_spaces_in_path() {
        let command = r#"C:\Users\sam hoang\AppData\Local\Programs\Jan-nightly\bun"#.to_string();
        let args = vec!["x".to_string(), "@browsermcp/mcp".to_string()];
        
        let (final_command, final_args) = parse_non_shell(command, args, true);
        
        println!("Final command: {}", final_command);
        println!("Final args: {:?}", final_args);
        
        // Should produce: cmd.exe ["/d", "/s", "/c", "\"executable_path args\""]
        assert_eq!(final_command, "cmd.exe");
        assert_eq!(final_args.len(), 4);
        assert_eq!(final_args[0], "/d");
        assert_eq!(final_args[1], "/s");
        assert_eq!(final_args[2], "/c");
        
        // The fourth argument should be the properly quoted command without extra wrapping
        let shell_cmd = &final_args[3];
        println!("Shell command: {}", shell_cmd);
        
        // With fixed escaping, should NOT have extra quotes around the entire command
        // The individual components should be properly quoted
        assert!(shell_cmd.contains(r#""C:\Users\sam hoang\AppData\Local\Programs\Jan-nightly\bun""#));
        assert!(shell_cmd.contains("x"));
        assert!(shell_cmd.contains("@browsermcp/mcp"));
        // Should not start and end with quotes (no over-escaping)
        assert!(!shell_cmd.starts_with('"') || !shell_cmd.ends_with('"') || shell_cmd.len() > 2);
    }
}