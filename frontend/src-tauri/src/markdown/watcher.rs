use serde::{Deserialize, Serialize};
use tauri::command;
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileChangeEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}

#[command]
pub async fn markdown_watch_vault(
    vault_path: String,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();

    let mut watcher: RecommendedWatcher = Watcher::new(tx, notify::Config::default())
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

    let watch_path = PathBuf::from(&vault_path);
    watcher.watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path: {}", e))?;

    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    if let EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) = event.kind {
                        for path in event.paths {
                            let rel_path = path.strip_prefix(&watch_path)
                                .ok()
                                .and_then(|p| p.to_str())
                                .map(|s| s.replace('\\', "/"))
                                .unwrap_or_default();

                            let event_type = match event.kind {
                                EventKind::Create(_) => "create",
                                EventKind::Modify(_) => "modify",
                                EventKind::Remove(_) => "delete",
                                _ => continue,
                            };

                            log::info!("File change: {} - {}", event_type, rel_path);
                        }
                    }
                }
                Err(e) => {
                    log::error!("Watcher error: {}", e);
                }
            }
        }
    });

    Ok(())
}

