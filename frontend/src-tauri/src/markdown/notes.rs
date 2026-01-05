use serde::{Deserialize, Serialize};
use tauri::command;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub children: Option<Vec<FileTreeNode>>,
    pub metadata: Option<serde_json::Value>,
}

#[command]
pub async fn markdown_get_file_tree(vault_path: String) -> Result<FileTreeNode, String> {
    let root_path = PathBuf::from(&vault_path);
    if !root_path.exists() {
        return Err("Vault path does not exist".to_string());
    }

    fn build_tree(path: &PathBuf, vault_root: &PathBuf) -> FileTreeNode {
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let rel_path = path.strip_prefix(vault_root)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_default();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            FileTreeNode {
                name,
                path: rel_path,
                node_type: "file".to_string(),
                children: None,
                metadata: None,
            }
        } else if path.is_dir() {
            let mut children = Vec::new();
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    let child_path = entry.path();
                    if child_path.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| !n.starts_with('.'))
                        .unwrap_or(false) {
                        children.push(build_tree(&child_path, vault_root));
                    }
                }
            }
            children.sort_by(|a, b| {
                match (&a.node_type, &b.node_type) {
                    ("folder", "file") => std::cmp::Ordering::Less,
                    ("file", "folder") => std::cmp::Ordering::Greater,
                    _ => a.name.cmp(&b.name),
                }
            });

            FileTreeNode {
                name,
                path: rel_path,
                node_type: "folder".to_string(),
                children: Some(children),
                metadata: None,
            }
        } else {
            FileTreeNode {
                name,
                path: rel_path,
                node_type: "file".to_string(),
                children: None,
                metadata: None,
            }
        }
    }

    Ok(build_tree(&root_path, &root_path))
}

