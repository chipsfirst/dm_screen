#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Открывает внешнюю ссылку в системном браузере.
/// В вебвью нативные сборки не умеют открывать target="_blank" сами.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let allowed = url.starts_with("https://") || url.starts_with("http://");
    if !allowed {
        return Err("разрешены только http(s)-ссылки".into());
    }
    if url.contains(|c: char| c.is_whitespace() || c == '"' || c == '\'') {
        return Err("в ссылке недопустимые символы".into());
    }

    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open").arg(&url).status();
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("cmd")
        .args(["/C", "start", "", url.as_str()])
        .status();
    #[cfg(all(unix, not(target_os = "macos")))]
    let status = std::process::Command::new("xdg-open").arg(&url).status();

    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(_) => Err("браузер не открылся".into()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file, open_external])
        .run(tauri::generate_context!())
        .expect("не удалось запустить приложение");
}
