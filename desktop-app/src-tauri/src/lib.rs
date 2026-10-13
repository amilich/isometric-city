// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Iso Games Desktop.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // Get the main window and configure it
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                // Open devtools in debug mode
                window.open_devtools();
            }
            let _ = app; // Silence unused warning in release mode
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
