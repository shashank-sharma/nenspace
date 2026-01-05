use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

mod markdown;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            markdown::notes::markdown_get_file_tree,
            markdown::search::markdown_init_index,
            markdown::search::markdown_index_note,
            markdown::search::markdown_remove_from_index,
            markdown::search::markdown_list_notes,
            markdown::search::markdown_search_notes,
            markdown::watcher::markdown_watch_vault,
        ])
        .setup(setup_app)
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create system tray menu
    let show_main_item = MenuItemBuilder::with_id("show_main", "Show Main Window").build(app)?;
    let reset_indicator_item = MenuItemBuilder::with_id("reset_indicator", "Reset Status Indicator").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show_main_item, &reset_indicator_item])
        .separator()
        .items(&[&quit_item])
        .build()?;

    // Create system tray with menu and icon
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("nenspace")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show_main" => {
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.show() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to show main window: {:?}", e);
                    }
                    if let Err(e) = window.set_focus() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to focus main window: {:?}", e);
                    }
                }
            }
            "reset_indicator" => {
                if let Some(window) = app.get_webview_window("status_indicator") {
                    if let Err(e) = window.emit("reset-widget-position", ()) {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to emit reset event: {:?}", e);
                    }
                    if let Err(e) = window.show() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to show status indicator: {:?}", e);
                    }
                    if let Err(e) = window.unminimize() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to unminimize status indicator: {:?}", e);
                    }
                    if let Err(e) = window.set_focus() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to focus status indicator: {:?}", e);
                    }
                }
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.show() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to show main window on tray click: {:?}", e);
                    }
                    if let Err(e) = window.set_focus() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to focus main window on tray click: {:?}", e);
                    }
                }
            }
        })
        .build(app)?;

    // Create floating status indicator window
    create_status_window(app.handle())?;

    Ok(())
}

fn create_status_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu for the status indicator window
    let reset_position_item = MenuItemBuilder::with_id("reset_position", "Reset Position to Top-Left").build(app)?;
    let toggle_expansion_item = MenuItemBuilder::with_id("toggle_expansion", "Toggle Expansion Mode (Edge/Center)").build(app)?;
    let show_dashboard_item = MenuItemBuilder::with_id("show_dashboard", "Show Dashboard").build(app)?;
    
    let widget_menu = MenuBuilder::new(app)
        .items(&[&reset_position_item, &toggle_expansion_item])
        .separator()
        .items(&[&show_dashboard_item])
        .build()?;
    
    let status_window = WebviewWindowBuilder::new(
        app,
        "status_indicator",
        WebviewUrl::App("status-indicator".into())
    )
    .title("Status Indicator")
    .inner_size(120.0, 40.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(true)
    .visible(true)
    .hidden_title(true)
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .menu(widget_menu)
    .on_menu_event(move |window, event| {
        match event.id().as_ref() {
            "reset_position" => {
                if let Err(e) = window.emit("reset-widget-position", ()) {
                    #[cfg(debug_assertions)]
                    eprintln!("Failed to emit reset event: {:?}", e);
                }
            }
            "toggle_expansion" => {
                println!("🔀 Toggle expansion mode command triggered");
                if let Err(e) = window.emit("toggle-expansion-mode", ()) {
                    #[cfg(debug_assertions)]
                    eprintln!("Failed to emit toggle expansion event: {:?}", e);
                } else {
                    println!("✅ Toggle expansion mode event emitted");
                }
            }
            "show_dashboard" => {
                if let Some(main_window) = window.app_handle().get_webview_window("main") {
                    if let Err(e) = main_window.show() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to show dashboard: {:?}", e);
                    }
                    if let Err(e) = main_window.set_focus() {
                        #[cfg(debug_assertions)]
                        eprintln!("Failed to focus dashboard: {:?}", e);
                    }
                }
            }
            _ => {}
        }
    })
    .build()?;

    // Ensure window is visible after creation
    if let Err(e) = status_window.show() {
        #[cfg(debug_assertions)]
        eprintln!("Failed to show status window after creation: {:?}", e);
    }

    // Set the webview background to transparent (macOS only)
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::base::{id, nil};
        
        let ns_window = status_window.ns_window().unwrap() as id;
        unsafe {
            let clear_color: id = NSColor::clearColor(nil);
            ns_window.setBackgroundColor_(clear_color);
            ns_window.setOpaque_(cocoa::base::NO);
        }
    }

    Ok(())
}

fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() == "main" {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Prevent app quit, just hide the main window
            if let Err(e) = window.hide() {
                #[cfg(debug_assertions)]
                eprintln!("Failed to hide main window: {:?}", e);
            }
            api.prevent_close();
        }
    }
}
