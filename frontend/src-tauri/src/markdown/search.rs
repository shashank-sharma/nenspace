use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Row};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::sync::Mutex;

// Global connection pool cache
lazy_static::lazy_static! {
    static ref DB_POOLS: Arc<Mutex<HashMap<String, Pool<Sqlite>>>> = Arc::new(Mutex::new(HashMap::new()));
}

async fn get_or_create_pool(db_path: &str) -> Result<Pool<Sqlite>, String> {
    let mut pools = DB_POOLS.lock().await;
    
    if let Some(pool) = pools.get(db_path) {
        return Ok(pool.clone());
    }
    
    let db_url = format!("sqlite:{}?mode=rwc", db_path);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    pools.insert(db_path.to_string(), pool.clone());
    Ok(pool)
}

#[command]
pub async fn markdown_init_index(index_path: String) -> Result<(), String> {
    let pool = get_or_create_pool(&index_path).await?;

    sqlx::query(r#"
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
        )
    "#)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create notes table: {}", e))?;

    sqlx::query(r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            content,
            tags,
            aliases,
            content=notes,
            content_rowid=id
        )
    "#)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create FTS table: {}", e))?;

    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS note_links (
            id TEXT PRIMARY KEY,
            source_note_path TEXT NOT NULL,
            target_note_path TEXT,
            target_path TEXT NOT NULL,
            link_type TEXT NOT NULL,
            position_line INTEGER
        )
    "#)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create note_links table: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_links_source ON note_links(source_note_path)")
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to create source index: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_links_target ON note_links(target_note_path)")
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to create target index: {}", e))?;

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
    let pool = get_or_create_pool(&indexPath).await?;

    let now = chrono::Utc::now().to_rfc3339();
    let note_id = format!("note_{}", path.replace('/', "_").replace('\\', "_"));

    sqlx::query(r#"
        INSERT OR REPLACE INTO notes (id, path, title, content, frontmatter, tags, aliases, word_count, checksum, created, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created FROM notes WHERE path = ?), ?), ?)
    "#)
    .bind(&note_id)
    .bind(&path)
    .bind(&title)
    .bind(&content)
    .bind(&frontmatter)
    .bind(&tags)
    .bind(&aliases)
    .bind(word_count)
    .bind(&checksum)
    .bind(&path)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to index note: {}", e))?;

    Ok(())
}

#[command]
pub async fn markdown_remove_from_index(index_path: String, path: String) -> Result<(), String> {
    let pool = get_or_create_pool(&index_path).await?;

    sqlx::query("DELETE FROM notes WHERE path = ?")
        .bind(&path)
        .execute(&pool)
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
    let pool = get_or_create_pool(&indexPath).await?;

    let query = if filter.is_empty() {
        "SELECT * FROM notes ORDER BY updated DESC".to_string()
    } else {
        format!("SELECT * FROM notes {} ORDER BY updated DESC", filter)
    };

    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;

    let notes: Vec<NoteResult> = rows
        .iter()
        .map(|row| {
            NoteResult {
                id: row.get::<String, _>("id"),
                path: row.get::<String, _>("path"),
                title: row.get::<String, _>("title"),
                created: row.get::<Option<String>, _>("created").unwrap_or_default(),
                updated: row.get::<Option<String>, _>("updated").unwrap_or_default(),
                tags: row.get::<Option<String>, _>("tags").unwrap_or_else(|| "[]".to_string()),
                aliases: row.get::<Option<String>, _>("aliases").unwrap_or_else(|| "[]".to_string()),
                link_count: 0,
                backlink_count: 0,
                word_count: row.get::<Option<i32>, _>("word_count").unwrap_or(0),
                is_starred: row.get::<Option<i32>, _>("is_starred").unwrap_or(0) != 0,
                is_template: row.get::<Option<i32>, _>("is_template").unwrap_or(0) != 0,
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
    let pool = get_or_create_pool(&indexPath).await?;

    let limit = limit.unwrap_or(50);
    let fts_query = query
        .split_whitespace()
        .map(|term| format!("\"{}\"*", term))
        .collect::<Vec<_>>()
        .join(" OR ");

    let sql = r#"
        SELECT n.*, bm25(notes_fts) as score,
               snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
        FROM notes_fts
        JOIN notes n ON notes_fts.rowid = n.id
        WHERE notes_fts MATCH ?
        ORDER BY score DESC
        LIMIT ?
    "#;

    let rows = sqlx::query(sql)
        .bind(&fts_query)
        .bind(limit)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    let results: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<String, _>("id"),
                "path": row.get::<String, _>("path"),
                "title": row.get::<String, _>("title"),
                "score": row.get::<f64, _>("score"),
                "snippet": row.get::<Option<String>, _>("snippet").unwrap_or_default(),
            })
        })
        .collect();

    Ok(results)
}
