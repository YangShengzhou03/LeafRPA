#![allow(clippy::needless_pass_by_value)]

pub mod commands;
pub mod python;

/// 启动 Tauri 应用。
///
/// # Panics
///
/// 当 Tauri 运行时初始化失败时 panic。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            commands::ensure_flows_dir(&handle)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_flows,
            commands::read_flow,
            commands::write_flow,
            commands::create_flow,
            commands::delete_flow,
            commands::open_in_browser,
            commands::data_dir,
            python::run_python_code,
            python::launch_chrome,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
