use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultConfig {
    pub name: String,
    pub settings: serde_json::Value,
    pub created: String,
}

