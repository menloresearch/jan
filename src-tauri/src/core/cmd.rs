use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::{fs, io, path::PathBuf};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_updater::UpdaterExt;
use base64::{engine::general_purpose, Engine as _};
use encoding_rs::UTF_8;

use super::{server, setup, state::AppState};

const CONFIGURATION_FILE_NAME: &str = "settings.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfiguration {
    pub data_folder: String,
    // Add other fields as needed
}
impl AppConfiguration {
    pub fn default() -> Self {
        Self {
            data_folder: String::from("./data"), // Set a default value for the data_folder
                                                 // Add other fields with default values as needed
        }
    }
}

#[tauri::command]
pub fn get_app_configurations<R: Runtime>(app_handle: tauri::AppHandle<R>) -> AppConfiguration {
    let mut app_default_configuration = AppConfiguration::default();

    if std::env::var("CI").unwrap_or_default() == "e2e" {
        return app_default_configuration;
    }

    let configuration_file = get_configuration_file_path(app_handle.clone());

    let default_data_folder = default_data_folder_path(app_handle.clone());

    if !configuration_file.exists() {
        log::info!(
            "App config not found, creating default config at {:?}",
            configuration_file
        );

        app_default_configuration.data_folder = default_data_folder;

        if let Err(err) = fs::write(
            &configuration_file,
            serde_json::to_string(&app_default_configuration).unwrap(),
        ) {
            log::error!("Failed to create default config: {}", err);
        }

        return app_default_configuration;
    }

    match fs::read_to_string(&configuration_file) {
        Ok(content) => match serde_json::from_str::<AppConfiguration>(&content) {
            Ok(app_configurations) => app_configurations,
            Err(err) => {
                log::error!(
                    "Failed to parse app config, returning default config instead. Error: {}",
                    err
                );
                app_default_configuration
            }
        },
        Err(err) => {
            log::error!(
                "Failed to read app config, returning default config instead. Error: {}",
                err
            );
            app_default_configuration
        }
    }
}

#[tauri::command]
pub fn update_app_configuration(
    app_handle: tauri::AppHandle,
    configuration: AppConfiguration,
) -> Result<(), String> {
    let configuration_file = get_configuration_file_path(app_handle);
    log::info!(
        "update_app_configuration, configuration_file: {:?}",
        configuration_file
    );

    fs::write(
        configuration_file,
        serde_json::to_string(&configuration).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_jan_data_folder_path<R: Runtime>(app_handle: tauri::AppHandle<R>) -> PathBuf {
    if cfg!(test) {
        return PathBuf::from("./data");
    }

    let app_configurations = get_app_configurations(app_handle);
    PathBuf::from(app_configurations.data_folder)
}

#[tauri::command]
pub fn get_jan_extensions_path(app_handle: tauri::AppHandle) -> PathBuf {
    get_jan_data_folder_path(app_handle).join("extensions")
}

#[tauri::command]
pub fn get_themes(app_handle: tauri::AppHandle) -> Vec<String> {
    let mut themes = vec![];
    let themes_path = get_jan_data_folder_path(app_handle).join("themes");
    if themes_path.exists() {
        for entry in fs::read_dir(themes_path).unwrap() {
            let entry = entry.unwrap();
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    themes.push(name.to_string());
                }
            }
        }
    }
    themes
}

#[tauri::command]
pub fn read_theme(app_handle: tauri::AppHandle, theme_name: String) -> Result<String, String> {
    let themes_path = get_jan_data_folder_path(app_handle)
        .join("themes")
        .join(theme_name.clone())
        .join("theme.json");
    if themes_path.exists() {
        let content = fs::read_to_string(themes_path).map_err(|e| e.to_string())?;
        Ok(content)
    } else {
        Err(format!("Theme {} not found", theme_name.clone()))
    }
}

#[tauri::command]
pub fn get_configuration_file_path<R: Runtime>(app_handle: tauri::AppHandle<R>) -> PathBuf {
    let app_path = app_handle.path().app_data_dir().unwrap_or_else(|err| {
        log::error!(
            "Failed to get app data directory: {}. Using home directory instead.",
            err
        );

        let home_dir = std::env::var(if cfg!(target_os = "windows") {
            "USERPROFILE"
        } else {
            "HOME"
        })
        .expect("Failed to determine the home directory");

        PathBuf::from(home_dir)
    });

    let package_name = env!("CARGO_PKG_NAME");
    #[cfg(target_os = "linux")]
    let old_data_dir = {
        if let Some(config_path) = dirs::config_dir() {
            config_path.join(package_name)
        } else {
            log::debug!("Could not determine config directory");
            app_path
                .parent()
                .unwrap_or(&app_path.join("../"))
                .join(package_name)
        }
    };

    #[cfg(not(target_os = "linux"))]
    let old_data_dir = app_path
        .parent()
        .unwrap_or(&app_path.join("../"))
        .join(package_name);

    if old_data_dir.exists() {
        return old_data_dir.join(CONFIGURATION_FILE_NAME);
    } else {
        return app_path.join(CONFIGURATION_FILE_NAME);
    }
}

#[tauri::command]
pub fn default_data_folder_path<R: Runtime>(app_handle: tauri::AppHandle<R>) -> String {
    let mut path = app_handle.path().data_dir().unwrap();

    let app_name = std::env::var("APP_NAME")
        .unwrap_or_else(|_| app_handle.config().product_name.clone().unwrap());
    path.push(app_name);
    path.push("data");

    let mut path_str = path.to_str().unwrap().to_string();

    if let Some(stripped) = path.to_str().unwrap().to_string().strip_suffix(".ai.app") {
        path_str = stripped.to_string();
    }

    path_str
}

#[tauri::command]
pub fn relaunch(app: AppHandle) {
    app.restart()
}

#[tauri::command]
pub fn open_app_directory(app: AppHandle) {
    let app_path = app.path().app_data_dir().unwrap();
    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(app_path)
            .spawn()
            .expect("Failed to open app directory");
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(app_path)
            .spawn()
            .expect("Failed to open app directory");
    } else {
        std::process::Command::new("xdg-open")
            .arg(app_path)
            .spawn()
            .expect("Failed to open app directory");
    }
}

#[tauri::command]
pub fn open_file_explorer(path: String) {
    let path = PathBuf::from(path);
    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .expect("Failed to open file explorer");
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .expect("Failed to open file explorer");
    } else {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .expect("Failed to open file explorer");
    }
}

#[tauri::command]
pub fn install_extensions(app: AppHandle) {
    if let Err(err) = setup::install_extensions(app, true) {
        log::error!("Failed to install extensions: {}", err);
    }
}

#[tauri::command]
pub fn get_active_extensions(app: AppHandle) -> Vec<serde_json::Value> {
    let mut path = get_jan_extensions_path(app);
    path.push("extensions.json");
    log::info!("get jan extensions, path: {:?}", path);

    let contents = fs::read_to_string(path);
    let contents: Vec<serde_json::Value> = match contents {
        Ok(data) => match serde_json::from_str::<Vec<serde_json::Value>>(&data) {
            Ok(exts) => exts
                .into_iter()
                .map(|ext| {
                    serde_json::json!({
                        "url": ext["url"],
                        "name": ext["name"],
                        "productName": ext["productName"],
                        "active": ext["_active"],
                        "description": ext["description"],
                        "version": ext["version"]
                    })
                })
                .collect(),
            Err(error) => {
                log::error!("Failed to parse extensions.json: {}", error);
                vec![]
            }
        },
        Err(error) => {
            log::error!("Failed to read extensions.json: {}", error);
            vec![]
        }
    };
    return contents;
}

#[tauri::command]
pub fn get_user_home_path(app: AppHandle) -> String {
    return get_app_configurations(app.clone()).data_folder;
}

/// Recursively copy a directory from src to dst
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), io::Error> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

/// Extract text from file content based on file type
#[tauri::command]
pub async fn extract_text_from_file(
    base64_content: String,
    file_name: String,
    file_type: String,
) -> Result<String, String> {
    log::info!("Extracting text from file: {} (type: {})", file_name, file_type);
    
    // Decode base64 content
    let content_bytes = general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| format!("Failed to decode base64 content: {}", e))?;

    // Determine file type from extension or MIME type
    let file_extension = std::path::Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    match file_extension.as_str() {
        // Plain text files
        "txt" | "md" | "json" | "html" | "css" | "js" | "ts" | "py" | "rs" | "xml" | "yaml" | "yml" => {
            extract_text_content(&content_bytes)
        }
        // DOCX files
        "docx" => extract_docx_text(&content_bytes),
        // PDF files
        "pdf" => extract_pdf_text(&content_bytes),
        _ => Err(format!("Unsupported file type: {}", file_extension)),
    }
}

/// Extract text content from plain text files with encoding detection
fn extract_text_content(content_bytes: &[u8]) -> Result<String, String> {
    // Try UTF-8 first
    if let Ok(text) = std::str::from_utf8(content_bytes) {
        return Ok(text.to_string());
    }

    // Use encoding_rs for robust encoding detection
    let (cow, _encoding_used, had_errors) = UTF_8.decode(content_bytes);
    
    if had_errors {
        // Try to detect encoding from BOM
        if let Some((encoding, _bom_length)) = encoding_rs::Encoding::for_bom(content_bytes) {
            let (decoded_text, _, had_errors) = encoding.decode(content_bytes);
            
            if had_errors {
                log::warn!("Text extraction had encoding errors, some characters may be corrupted");
            }
            
            Ok(decoded_text.into_owned())
        } else {
            // Fallback to UTF-8 with replacement characters
            log::warn!("Could not detect encoding, using UTF-8 with replacement characters");
            Ok(cow.into_owned())
        }
    } else {
        Ok(cow.into_owned())
    }
}

/// Extract text from DOCX files
fn extract_docx_text(content_bytes: &[u8]) -> Result<String, String> {
    match docx_rs::read_docx(content_bytes) {
        Ok(docx) => {
            let mut text_content = String::new();
            
            // Extract text from document children
            for child in &docx.document.children {
                match child {
                    docx_rs::DocumentChild::Paragraph(paragraph) => {
                        for run in &paragraph.children {
                            match run {
                                docx_rs::ParagraphChild::Run(run) => {
                                    for run_child in &run.children {
                                        if let docx_rs::RunChild::Text(text) = run_child {
                                            text_content.push_str(&text.text);
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                        text_content.push('\n');
                    }
                    _ => {}
                }
            }
            
            Ok(text_content.trim().to_string())
        }
        Err(e) => Err(format!("Failed to parse DOCX file: {}", e)),
    }
}

/// Extract text from PDF files
fn extract_pdf_text(content_bytes: &[u8]) -> Result<String, String> {
    match pdf_extract::extract_text_from_mem(content_bytes) {
        Ok(text) => Ok(text.trim().to_string()),
        Err(e) => Err(format!("Failed to extract text from PDF: {}", e)),
    }
}

/// Save base64 content to a file in the rag-docs directory and return the path
#[tauri::command]
pub async fn save_file(
    base64_content: String,
    file_name: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("Saving file to rag-docs: {}", file_name);
    
    // Decode base64 content
    let content_bytes = general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| format!("Failed to decode base64 content: {}", e))?;

    // Get app data directory and create rag-docs subdirectory
    let app_data_path = get_jan_data_folder_path(app_handle);
    let rag_docs_dir = app_data_path.join("rag-docs");
    
    // Ensure rag-docs directory exists
    if !rag_docs_dir.exists() {
        std::fs::create_dir_all(&rag_docs_dir)
            .map_err(|e| format!("Failed to create rag-docs directory: {}", e))?;
    }

    // Generate unique filename to avoid conflicts
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    // Extract file extension from original filename
    let extension = std::path::Path::new(&file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    
    // Create unique filename with timestamp prefix
    let unique_filename = if extension.is_empty() {
        format!("{}_{}", timestamp, file_name)
    } else {
        let stem = std::path::Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        format!("{}_{}.{}", timestamp, stem, extension)
    };
    
    let file_path = rag_docs_dir.join(&unique_filename);

    // Write content to file
    std::fs::write(&file_path, &content_bytes)
        .map_err(|e| format!("Failed to write to file: {}", e))?;

    // Get the absolute path as string
    let file_path_str = file_path.to_string_lossy().to_string();
    
    log::info!("File saved at: {}", file_path_str);
    Ok(file_path_str)
}

#[tauri::command]
pub async fn reset_cortex_restart_count(state: State<'_, AppState>) -> Result<(), String> {
    let mut count = state.cortex_restart_count.lock().await;
    *count = 0;
    log::info!("Cortex server restart count reset to 0.");
    Ok(())
}

#[tauri::command]
pub fn change_app_data_folder(
    app_handle: tauri::AppHandle,
    new_data_folder: String,
) -> Result<(), String> {
    // Get current data folder path
    let current_data_folder = get_jan_data_folder_path(app_handle.clone());
    let new_data_folder_path = PathBuf::from(&new_data_folder);

    // Create the new data folder if it doesn't exist
    if !new_data_folder_path.exists() {
        fs::create_dir_all(&new_data_folder_path)
            .map_err(|e| format!("Failed to create new data folder: {}", e))?;
    }

    // Copy all files from the old folder to the new one
    if current_data_folder.exists() {
        log::info!(
            "Copying data from {:?} to {:?}",
            current_data_folder,
            new_data_folder_path
        );

        copy_dir_recursive(&current_data_folder, &new_data_folder_path)
            .map_err(|e| format!("Failed to copy data to new folder: {}", e))?;
    } else {
        log::info!("Current data folder does not exist, nothing to copy");
    }

    // Update the configuration to point to the new folder
    let mut configuration = get_app_configurations(app_handle.clone());
    configuration.data_folder = new_data_folder;

    // Save the updated configuration
    update_app_configuration(app_handle, configuration)
}

#[tauri::command]
pub fn app_token(state: State<'_, AppState>) -> Option<String> {
    state.app_token.clone()
}

#[tauri::command]
pub async fn start_server(
    app: AppHandle,
    host: String,
    port: u16,
    prefix: String,
) -> Result<bool, String> {
    server::start_server(host, port, prefix, app_token(app.state()).unwrap())
        .await
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn stop_server() -> Result<(), String> {
    server::stop_server().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn read_logs(app: AppHandle) -> Result<String, String> {
    let log_path = get_jan_data_folder_path(app).join("logs").join("app.log");
    if log_path.exists() {
        let content = fs::read_to_string(log_path).map_err(|e| e.to_string())?;
        Ok(content)
    } else {
        Err(format!("Log file not found"))
    }
}

#[tauri::command]
pub async fn handle_app_update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        let mut downloaded = 0;

        // alternatively we could also call update.download() and update.install() separately
        log::info!(
            "Has update {} {} {}",
            update.version,
            update.current_version,
            update.download_url
        );
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    log::info!("downloaded {downloaded} from {content_length:?}");
                },
                || {
                    log::info!("download finished");
                },
            )
            .await?;

        log::info!("update installed");
        let client = Client::new();
        let url = "http://127.0.0.1:39291/processManager/destroy";
        let _ = client.delete(url).send();
        app.restart();
    } else {
        log::info!("Cannot parse response or update is not available");
    }

    Ok(())
}
