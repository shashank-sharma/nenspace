use serde::{Deserialize, Serialize};
use tauri::command;
use tauri_plugin_sql::{Migration, MigrationKind};

#[command]
pub async fn markdown_init_index(index_path: String) -> Result<(), String> {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial schema",
            sql: r#"
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    frontmatter TEXT,
                    tags TEXT,
                    aliases TEXT,
                    word_count INTEGER,
                    checksum TEXT,
                    created TEXT,
                    updated TEXT,
                    is_starred INTEGER DEFAULT 0,
                    is_template INTEGER DEFAULT 0
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                    title,
                    content,
                    tags,
                    aliases,
                    content=notes,
                    content_rowid=id
                );

                CREATE TABLE IF NOT EXISTS note_links (
                    id TEXT PRIMARY KEY,
                    source_note_path TEXT NOT NULL,
                    target_note_path TEXT,
                    target_path TEXT NOT NULL,
                    link_type TEXT NOT NULL,
                    position_line INTEGER
                );

                CREATE INDEX IF NOT EXISTS idx_links_source ON note_links(source_note_path);
                CREATE INDEX IF NOT EXISTS idx_links_target ON note_links(target_note_path);
            "#,
            kind: MigrationKind::Up,
        },
    ];

    let _db = tauri_plugin_sql::DbPool::load(&format!("sqlite:{}", index_path), migrations)
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    Ok(())
}

#[command]
pub async fn markdown_index_note(
    indexPath: String,
    path: String,
    title: String,
    content: String,
    frontmatter: String,
    tags: String,
    aliases: String,
    word_count: i32,
    checksum: String,
) -> Result<(), String> {
    let db = tauri_plugin_sql::DbPool::load(&format!("sqlite:{}", indexPath), vec![])
        .map_err(|e| format!("Database error: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let note_id = format!("note_{}", path.replace('/', "_").replace('\\', "_"));

    db.execute(
        r#"
        INSERT OR REPLACE INTO notes (id, path, title, content, frontmatter, tags, aliases, word_count, checksum, created, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created FROM notes WHERE path = ?), ?), ?)
        "#,
        &[
            &note_id, &path, &title, &content, &frontmatter, &tags, &aliases,
            &word_count.to_string(), &checksum, &path, &now, &now
        ],
    )
    .await
    .map_err(|e| format!("Failed to index note: {}", e))?;

    db.execute(
        r#"
        INSERT OR REPLACE INTO notes_fts (rowid, title, content, tags, aliases)
        VALUES ((SELECT id FROM notes WHERE path = ?), ?, ?, ?, ?)
        "#,
        &[&path, &title, &content, &tags, &aliases],
    )
    .await
    .map_err(|e| format!("Failed to update FTS index: {}", e))?;

    Ok(())
}

#[command]
pub async fn markdown_remove_from_index(index_path: String, path: String) -> Result<(), String> {
    let db = tauri_plugin_sql::DbPool::load(&format!("sqlite:{}", index_path), vec![])
        .map_err(|e| format!("Database error: {}", e))?;

    db.execute(
        "DELETE FROM notes WHERE path = ?",
        &[&path],
    )
    .await
    .map_err(|e| format!("Failed to remove note: {}", e))?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteResult {
    pub id: String,
    pub path: String,
    pub title: String,
    pub created: String,
    pub updated: String,
    pub tags: String,
    pub aliases: String,
    pub link_count: i32,
    pub backlink_count: i32,
    pub word_count: i32,
    pub is_starred: bool,
    pub is_template: bool,
}

#[command]
pub async fn markdown_list_notes(
    indexPath: String,
    filter: String,
) -> Result<Vec<NoteResult>, String> {
    let db = tauri_plugin_sql::DbPool::load(&format!("sqlite:{}", indexPath), vec![])
        .map_err(|e| format!("Database error: {}", e))?;

    let query = if filter.is_empty() {
        "SELECT * FROM notes ORDER BY updated DESC".to_string()
    } else {
        format!("SELECT * FROM notes {} ORDER BY updated DESC", filter)
    };

    let results: Vec<serde_json::Value> = db
        .select(&query, &[])
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    let notes: Vec<NoteResult> = results
        .into_iter()
        .map(|row| {
            let link_count = row.get("link_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let backlink_count = row.get("backlink_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

            NoteResult {
                id: row.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                path: row.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                title: row.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                created: row.get("created").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                updated: row.get("updated").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                tags: row.get("tags").and_then(|v| v.as_str()).unwrap_or("[]").to_string(),
                aliases: row.get("aliases").and_then(|v| v.as_str()).unwrap_or("[]").to_string(),
                link_count,
                backlink_count,
                word_count: row.get("word_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                is_starred: row.get("is_starred").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
                is_template: row.get("is_template").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
            }
        })
        .collect();

    Ok(notes)
}

#[command]
pub async fn markdown_search_notes(
    indexPath: String,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = tauri_plugin_sql::DbPool::load(&format!("sqlite:{}", indexPath), vec![])
        .map_err(|e| format!("Database error: {}", e))?;

    let limit = limit.unwrap_or(50);
    let fts_query = query
        .split_whitespace()
        .map(|term| format!("\"{}\"*", term))
        .collect::<Vec<_>>()
        .join(" OR ");

    let sql = format!(
        r#"
        SELECT n.*, bm25(notes_fts) as score,
               snippet(notes_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
        FROM notes_fts
        JOIN notes n ON notes_fts.rowid = n.id
        WHERE notes_fts MATCH ?
        ORDER BY score DESC
        LIMIT ?
        "#,
    );

    let results: Vec<serde_json::Value> = db
        .select(&sql, &[&fts_query, &limit.to_string()])
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    Ok(results)
}

