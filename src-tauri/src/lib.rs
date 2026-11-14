#![allow(clippy::needless_pass_by_value)]

pub mod commands;
pub mod python;
pub mod triggers;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};

/// 显示主窗口并聚焦。
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

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
            // 元素编辑器窗口的数据共享状态
            app.manage(commands::ElementEditorState::default());
            // 触发器常驻调度线程（每 5 秒扫描，到期发 trigger-due 事件）
            triggers::start(&handle);

            // 系统托盘：显示主界面 / 退出
            let show = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::with_id("leaf-tray")
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .expect("缺少应用默认图标"),
                )
                .tooltip("轻羽 RPA")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 双击托盘图标恢复主窗口
                    if matches!(event, tauri::tray::TrayIconEvent::DoubleClick { .. }) {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 按设置分流关闭请求：退出 / 最小化窗口 / 最小化到托盘
            // 仅对主窗口生效，元素编辑器等子窗口关掉就是关掉
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                let action = commands::load_settings(window.app_handle()).close_action;
                match action.as_str() {
                    "minimize" => {
                        let _ = window.minimize();
                        api.prevent_close();
                    }
                    "tray" => {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                    _ => {} // exit：放行关闭，应用随最后一个窗口退出
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_flows,
            commands::read_flow,
            commands::write_flow,
            commands::create_flow,
            commands::delete_flow,
            commands::open_in_browser,
            commands::data_dir,
            commands::get_settings,
            commands::set_close_action,
            commands::set_data_root,
            commands::pick_folder,
            commands::set_element_editor_data,
            commands::take_element_editor_data,
            commands::open_element_editor,
            commands::close_element_editor,
            triggers::get_triggers,
            triggers::save_triggers,
            triggers::set_tz_offset,
            python::run_python_code,
            python::launch_chrome,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
