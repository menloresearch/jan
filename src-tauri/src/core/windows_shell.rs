//! Windows PowerShell command processor for MCP
//!
//! Provides comprehensive command processing logic equivalent to Node.js cross-spawn
//! for proper Windows shell handling with escaping and shebang detection.
//! Uses PowerShell as the primary shell execution environment.

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


/// Escape command for PowerShell
fn escape_command_powershell(command: &str) -> String {
    // PowerShell uses single quotes for literal strings to avoid variable expansion
    // For commands with spaces, use single-quoting
    if command.contains(' ') || command.contains('\t') {
        // If already quoted with single quotes, return as-is
        if command.starts_with('\'') && command.ends_with('\'') {
            command.to_string()
        } else {
            // Escape single quotes by doubling them and wrap in single quotes
            let escaped_quotes = command.replace('\'', "''");
            format!("'{}'", escaped_quotes)
        }
    } else {
        // No spaces, return as-is
        command.to_string()
    }
}

/// Escape argument for PowerShell
fn escape_argument_powershell(arg: &str) -> String {
    // PowerShell special characters that need escaping
    let needs_escaping = arg.contains(' ') || arg.contains('\t') || arg.contains('\'') ||
                        arg.contains('"') || arg.contains('$') || arg.contains('`') ||
                        arg.contains(';') || arg.contains('|') || arg.contains('&') ||
                        arg.contains('<') || arg.contains('>') || arg.contains('(') ||
                        arg.contains(')') || arg.contains('[') || arg.contains(']') ||
                        arg.contains('{') || arg.contains('}');
    
    if needs_escaping {
        // Use single quotes for literal strings to avoid variable expansion
        if arg.starts_with('\'') && arg.ends_with('\'') {
            arg.to_string()
        } else {
            // Escape single quotes by doubling them and wrap in single quotes
            let escaped_quotes = arg.replace('\'', "''");
            format!("'{}'", escaped_quotes)
        }
    } else {
        // No special characters, return as-is
        arg.to_string()
    }
}

/// Main shell processing logic for Windows using PowerShell
/// Uses PowerShell as the primary shell for all command execution
pub fn parse_non_shell(
    command: String,
    args: Vec<String>,
    force_shell: bool,
) -> (String, Vec<String>) {
    parse_powershell(command, args, force_shell)
}

/// Shell processing logic using PowerShell
pub fn parse_powershell(
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
    
    process_with_powershell(command, args)
}

/// Process command using PowerShell
fn process_with_powershell(mut command: String, args: Vec<String>) -> (String, Vec<String>) {
    // Normalize POSIX paths to Windows paths (foo/bar -> foo\bar)
    command = command.replace('/', "\\");
    
    // Escape command and arguments for PowerShell
    let escaped_command = escape_command_powershell(&command);
    let escaped_args: Vec<String> = args.iter()
        .map(|arg| escape_argument_powershell(arg))
        .collect();
    
    // Build PowerShell command
    let shell_command = if escaped_args.is_empty() {
        format!("& {}", escaped_command)
    } else {
        format!("& {} {}", escaped_command, escaped_args.join(" "))
    };
    
    // Use PowerShell with proper arguments
    let powershell = "powershell.exe".to_string();
    
    // PowerShell arguments: -WindowStyle Hidden hides the PowerShell window
    // -NoLogo suppresses the PowerShell startup banner
    // -NoProfile -NonInteractive -Command for clean execution
    let ps_args = vec![
        "-WindowStyle".to_string(),
        "Hidden".to_string(),
        "-NoLogo".to_string(),
        "-NoProfile".to_string(),
        "-NonInteractive".to_string(),
        "-Command".to_string(),
        shell_command,
    ];
    
    log::debug!("Windows PowerShell processor (hidden): {} {}", powershell, ps_args.join(" "));
    
    (powershell, ps_args)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_non_shell_with_spaces_in_path_powershell() {
        let command = r#"C:\Users\sam hoang\AppData\Local\Programs\Jan-nightly\bun"#.to_string();
        let args = vec!["x".to_string(), "@browsermcp/mcp".to_string()];
        
        let (final_command, final_args) = parse_non_shell(command, args, true);
        
        println!("Final command: {}", final_command);
        println!("Final args: {:?}", final_args);
        
        // Should produce: powershell.exe ["-WindowStyle", "Hidden", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "& 'command' 'args'"]
        assert_eq!(final_command, "powershell.exe");
        assert_eq!(final_args.len(), 7);
        assert_eq!(final_args[0], "-WindowStyle");
        assert_eq!(final_args[1], "Hidden");
        assert_eq!(final_args[2], "-NoLogo");
        assert_eq!(final_args[3], "-NoProfile");
        assert_eq!(final_args[4], "-NonInteractive");
        assert_eq!(final_args[5], "-Command");
        
        // The seventh argument should be the PowerShell command
        let shell_cmd = &final_args[6];
        println!("PowerShell command: {}", shell_cmd);
        
        // Should use & operator and single quotes for PowerShell
        assert!(shell_cmd.starts_with("& "));
        assert!(shell_cmd.contains("'C:\\Users\\sam hoang\\AppData\\Local\\Programs\\Jan-nightly\\bun'"));
        assert!(shell_cmd.contains("'x'"));
        assert!(shell_cmd.contains("'@browsermcp/mcp'"));
    }

    #[test]
    fn test_parse_powershell() {
        let command = "npm".to_string();
        let args = vec!["install".to_string(), "--save".to_string()];
        
        let (final_command, final_args) = parse_powershell(command, args, true);
        
        println!("PowerShell Final command: {}", final_command);
        println!("PowerShell Final args: {:?}", final_args);
        
        // Should produce: powershell.exe ["-WindowStyle", "Hidden", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "& npm install --save"]
        assert_eq!(final_command, "powershell.exe");
        assert_eq!(final_args.len(), 7);
        assert_eq!(final_args[0], "-WindowStyle");
        assert_eq!(final_args[1], "Hidden");
        assert_eq!(final_args[2], "-NoLogo");
        assert_eq!(final_args[3], "-NoProfile");
        assert_eq!(final_args[4], "-NonInteractive");
        assert_eq!(final_args[5], "-Command");
        
        let shell_cmd = &final_args[6];
        assert!(shell_cmd.starts_with("& "));
        assert!(shell_cmd.contains("npm"));
        assert!(shell_cmd.contains("install"));
        assert!(shell_cmd.contains("--save"));
    }

    #[test]
    fn test_escape_command_powershell() {
        assert_eq!(escape_command_powershell("simple"), "simple");
        assert_eq!(escape_command_powershell("with space"), "'with space'");
        assert_eq!(escape_command_powershell("with'quote"), "'with''quote'");
        assert_eq!(escape_command_powershell("'already quoted'"), "'already quoted'");
    }

    #[test]
    fn test_escape_argument_powershell() {
        assert_eq!(escape_argument_powershell("simple"), "simple");
        assert_eq!(escape_argument_powershell("with space"), "'with space'");
        assert_eq!(escape_argument_powershell("$variable"), "'$variable'");
        assert_eq!(escape_argument_powershell("with|pipe"), "'with|pipe'");
        assert_eq!(escape_argument_powershell("with'quote"), "'with''quote'");
    }

    #[test]
    fn test_executable_detection() {
        assert!(is_executable("program.exe"));
        assert!(is_executable("program.com"));
        assert!(!is_executable("script.bat"));
        assert!(!is_executable("script.js"));
    }
}