package vectorsearch

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

// SQLiteVecStore implements the VectorStore interface using SQLite-Vec extension
type SQLiteVecStore struct {
	db                   *sql.DB
	dimensions           int
	indexType            string
	distanceMetric       string
	defaultThreshold     float64
	initialized          bool
	mu                   sync.RWMutex
	registeredCollections map[string]bool
}

func init() {
	// Register the SQLite-Vec store factory
	RegisterStore("sqlite", NewSQLiteVecStore)
}

// NewSQLiteVecStore creates a new SQLite-Vec vector store
func NewSQLiteVecStore(db *sql.DB, options VectorStoreOptions) (VectorStore, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection is required")
	}

	dimensions := options.Dimensions
	if dimensions <= 0 {
		dimensions = 768 // Default dimensions
	}

	indexType := options.IndexType
	if indexType == "" {
		indexType = "flat" // Default index type
	}

	distanceMetric := options.DistanceMetric
	if distanceMetric == "" {
		distanceMetric = "cosine" // Default distance metric
	}

	defaultThreshold := options.DefaultThreshold
	if defaultThreshold <= 0 {
		defaultThreshold = 0.75 // Default similarity threshold
	}

	return &SQLiteVecStore{
		db:                    db,
		dimensions:            dimensions,
		indexType:             indexType,
		distanceMetric:        distanceMetric,
		defaultThreshold:      defaultThreshold,
		registeredCollections: make(map[string]bool),
	}, nil
}

// Initialize sets up the SQLite-Vec extension and required tables
func (s *SQLiteVecStore) Initialize(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.initialized {
		return nil
	}

	logger.LogInfo("Initializing SQLite-Vec store")

	// Check if the sqlite-vec extension is available
	_, err := s.db.ExecContext(ctx, "SELECT sqlite3_vec_version();")
	if err != nil {
		// Try to load the extension
		_, err = s.db.ExecContext(ctx, "SELECT load_extension('sqlite-vec');")
		if err != nil {
			return fmt.Errorf("failed to load SQLite-Vec extension: %w", err)
		}
	}

	// Create the embeddings metadata table if it doesn't exist
	_, err = s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS _vector_embeddings (
			id TEXT PRIMARY KEY,
			collection_id TEXT NOT NULL,
			record_id TEXT NOT NULL,
			metadata TEXT,
			created TIMESTAMP,
			updated TIMESTAMP,
			UNIQUE(collection_id, record_id, id)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create embeddings metadata table: %w", err)
	}

	// Create index on collection_id and record_id
	_, err = s.db.ExecContext(ctx, `
		CREATE INDEX IF NOT EXISTS idx_embeddings_collection_record
		ON _vector_embeddings (collection_id, record_id)
	`)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	// Create the collections table to track registered collections
	_, err = s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS _vector_collections (
			collection_id TEXT PRIMARY KEY,
			fields TEXT,
			created TIMESTAMP,
			updated TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create collections table: %w", err)
	}

	// Load registered collections into memory
	rows, err := s.db.QueryContext(ctx, "SELECT collection_id FROM _vector_collections")
	if err != nil {
		return fmt.Errorf("failed to query registered collections: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var collectionID string
		if err := rows.Scan(&collectionID); err != nil {
			return fmt.Errorf("failed to scan collection ID: %w", err)
		}
		s.registeredCollections[collectionID] = true
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating over rows: %w", err)
	}

	s.initialized = true
	logger.LogInfo("SQLite-Vec store initialized successfully")
	return nil
}

// RegisterCollection registers a collection for vector search
func (s *SQLiteVecStore) RegisterCollection(ctx context.Context, collectionName string, fields []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return ErrStoreNotInitialized
	}

	// Check if collection exists in PocketBase
	_, err := store.GetDao().FindCollectionByNameOrId(collectionName)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrCollectionNotFound, err)
	}

	// Check if the collection is already registered
	if _, exists := s.registeredCollections[collectionName]; exists {
		logger.LogInfo(fmt.Sprintf("Collection %s already registered for vector search", collectionName))
		return nil
	}

	// Create the vector table for this collection
	_, err = s.db.ExecContext(ctx, fmt.Sprintf(`
		CREATE VIRTUAL TABLE IF NOT EXISTS %s_vec USING vec0(
			id, embedding(%d), metadata
		)
	`, collectionName, s.dimensions))
	if err != nil {
		return fmt.Errorf("failed to create vector table for collection %s: %w", collectionName, err)
	}

	// Store the collection registration
	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return fmt.Errorf("failed to serialize fields: %w", err)
	}

	now := time.Now().UTC()
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO _vector_collections (collection_id, fields, created, updated)
		VALUES (?, ?, ?, ?)
	`, collectionName, string(fieldsJSON), now, now)
	if err != nil {
		return fmt.Errorf("failed to register collection: %w", err)
	}

	// Update in-memory tracking
	s.registeredCollections[collectionName] = true

	logger.LogInfo(fmt.Sprintf("Registered collection %s for vector search", collectionName))
	return nil
}

// UnregisterCollection removes a collection from vector search
func (s *SQLiteVecStore) UnregisterCollection(ctx context.Context, collectionName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return ErrStoreNotInitialized
	}

	// Check if the collection is registered
	if _, exists := s.registeredCollections[collectionName]; !exists {
		return fmt.Errorf("%w: collection %s not registered for vector search", ErrCollectionNotFound, collectionName)
	}

	// Drop the vector table
	_, err := s.db.ExecContext(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s_vec", collectionName))
	if err != nil {
		return fmt.Errorf("failed to drop vector table: %w", err)
	}

	// Remove from collections table
	_, err = s.db.ExecContext(ctx, "DELETE FROM _vector_collections WHERE collection_id = ?", collectionName)
	if err != nil {
		return fmt.Errorf("failed to unregister collection: %w", err)
	}

	// Remove all embeddings for this collection
	_, err = s.db.ExecContext(ctx, "DELETE FROM _vector_embeddings WHERE collection_id = ?", collectionName)
	if err != nil {
		return fmt.Errorf("failed to delete embeddings for collection: %w", err)
	}

	// Update in-memory tracking
	delete(s.registeredCollections, collectionName)

	logger.LogInfo(fmt.Sprintf("Unregistered collection %s from vector search", collectionName))
	return nil
}

// StoreEmbedding stores an embedding for a record
func (s *SQLiteVecStore) StoreEmbedding(ctx context.Context, collectionName, recordID string, vector []float32, metadata Metadata) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return "", ErrStoreNotInitialized
	}

	// Check if the collection is registered
	if _, exists := s.registeredCollections[collectionName]; !exists {
		return "", fmt.Errorf("%w: collection %s not registered for vector search", ErrCollectionNotFound, collectionName)
	}

	// Generate a unique ID for the embedding
	id := util.GenerateRandomId()

	// Convert vector to JSON string
	vectorJSON, err := MarshalVector(vector)
	if err != nil {
		return "", fmt.Errorf("failed to marshal vector: %w", err)
	}

	// Convert metadata to JSON string
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return "", fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Start a transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Insert into vector table
	_, err = tx.ExecContext(ctx, fmt.Sprintf(`
		INSERT INTO %s_vec (id, embedding, metadata)
		VALUES (?, ?, ?)
	`, collectionName), id, vectorJSON, string(metadataJSON))
	if err != nil {
		return "", fmt.Errorf("failed to insert into vector table: %w", err)
	}

	// Store embedding metadata
	now := time.Now().UTC()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO _vector_embeddings (id, collection_id, record_id, metadata, created, updated)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, collectionName, recordID, string(metadataJSON), now, now)
	if err != nil {
		return "", fmt.Errorf("failed to store embedding metadata: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return "", fmt.Errorf("failed to commit transaction: %w", err)
	}

	return id, nil
}

// UpdateEmbedding updates an existing embedding
func (s *SQLiteVecStore) UpdateEmbedding(ctx context.Context, id string, vector []float32, metadata Metadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return ErrStoreNotInitialized
	}

	// Retrieve the embedding to get its collection
	embedding, err := s.GetEmbedding(ctx, id)
	if err != nil {
		return err
	}

	// Convert vector to JSON string
	vectorJSON, err := MarshalVector(vector)
	if err != nil {
		return fmt.Errorf("failed to marshal vector: %w", err)
	}

	// Convert metadata to JSON string
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Start a transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Update the vector table
	_, err = tx.ExecContext(ctx, fmt.Sprintf(`
		UPDATE %s_vec
		SET embedding = ?, metadata = ?
		WHERE id = ?
	`, embedding.CollectionID), vectorJSON, string(metadataJSON), id)
	if err != nil {
		return fmt.Errorf("failed to update vector: %w", err)
	}

	// Update the embedding metadata
	now := time.Now().UTC()
	_, err = tx.ExecContext(ctx, `
		UPDATE _vector_embeddings
		SET metadata = ?, updated = ?
		WHERE id = ?
	`, string(metadataJSON), now, id)
	if err != nil {
		return fmt.Errorf("failed to update embedding metadata: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// DeleteEmbedding removes an embedding
func (s *SQLiteVecStore) DeleteEmbedding(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return ErrStoreNotInitialized
	}

	// Retrieve the embedding to get its collection
	embedding, err := s.GetEmbedding(ctx, id)
	if err != nil {
		return err
	}

	// Start a transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Delete from vector table
	_, err = tx.ExecContext(ctx, fmt.Sprintf(`
		DELETE FROM %s_vec
		WHERE id = ?
	`, embedding.CollectionID), id)
	if err != nil {
		return fmt.Errorf("failed to delete from vector table: %w", err)
	}

	// Delete from embeddings metadata table
	_, err = tx.ExecContext(ctx, `
		DELETE FROM _vector_embeddings
		WHERE id = ?
	`, id)
	if err != nil {
		return fmt.Errorf("failed to delete embedding metadata: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// DeleteAllEmbeddingsForRecord removes all embeddings for a record
func (s *SQLiteVecStore) DeleteAllEmbeddingsForRecord(ctx context.Context, collectionName, recordID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return ErrStoreNotInitialized
	}

	// Check if the collection is registered
	if _, exists := s.registeredCollections[collectionName]; !exists {
		return fmt.Errorf("%w: collection %s not registered for vector search", ErrCollectionNotFound, collectionName)
	}

	// Get embeddings for the record
	embeddings, err := s.GetEmbeddingsForRecord(ctx, collectionName, recordID)
	if err != nil {
		return err
	}

	if len(embeddings) == 0 {
		return nil // No embeddings to delete
	}

	// Start a transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Build a list of embedding IDs
	var ids []string
	for _, embedding := range embeddings {
		ids = append(ids, embedding.ID)
	}

	// Create placeholders for the IN clause
	placeholders := strings.Repeat("?,", len(ids))
	placeholders = placeholders[:len(placeholders)-1] // Remove trailing comma

	// Delete from vector table
	query := fmt.Sprintf(`
		DELETE FROM %s_vec
		WHERE id IN (%s)
	`, collectionName, placeholders)
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		args[i] = id
	}

	_, err = tx.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete from vector table: %w", err)
	}

	// Delete from embeddings metadata table
	query = fmt.Sprintf(`
		DELETE FROM _vector_embeddings
		WHERE collection_id = ? AND record_id = ?
	`)
	_, err = tx.ExecContext(ctx, query, collectionName, recordID)
	if err != nil {
		return fmt.Errorf("failed to delete embedding metadata: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// SearchSimilar finds similar vectors in a collection
func (s *SQLiteVecStore) SearchSimilar(ctx context.Context, collectionName string, queryVector []float32, limit int, threshold float64) ([]VectorSearchResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.initialized {
		return nil, ErrStoreNotInitialized
	}

	// Check if the collection is registered
	if _, exists := s.registeredCollections[collectionName]; !exists {
		return nil, fmt.Errorf("%w: collection %s not registered for vector search", ErrCollectionNotFound, collectionName)
	}

	// Apply default limit if not specified
	if limit <= 0 {
		limit = 10
	}

	// Apply default threshold if not specified
	if threshold <= 0 {
		threshold = s.defaultThreshold
	}

	// Convert query vector to JSON
	queryVectorJSON, err := MarshalVector(queryVector)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query vector: %w", err)
	}

	// Query for similar vectors
	// Note: We're using a join to get both the vector data and the metadata
	query := fmt.Sprintf(`
		SELECT 
			v.id, 
			v.metadata,
			e.record_id,
			vss_cosine(v.embedding, ?) AS score,
			vss_distance(v.embedding, ?) AS distance
		FROM 
			%s_vec v
		JOIN 
			_vector_embeddings e ON v.id = e.id
		WHERE 
			vss_cosine(v.embedding, ?) >= ?
		ORDER BY 
			score DESC
		LIMIT ?
	`, collectionName)

	rows, err := s.db.QueryContext(
		ctx, 
		query, 
		queryVectorJSON, 
		queryVectorJSON, 
		queryVectorJSON, 
		threshold, 
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to execute search query: %w", err)
	}
	defer rows.Close()

	var results []VectorSearchResult
	for rows.Next() {
		var (
			id         string
			metadataStr string
			recordID   string
			score      float64
			distance   float64
		)

		if err := rows.Scan(&id, &metadataStr, &recordID, &score, &distance); err != nil {
			return nil, fmt.Errorf("failed to scan result row: %w", err)
		}

		// Parse metadata
		var meta Metadata
		if err := json.Unmarshal([]byte(metadataStr), &meta); err != nil {
			logger.LogWarning(fmt.Sprintf("Failed to parse metadata for embedding %s: %v", id, err))
			continue
		}

		// Get the record data
		data, err := s.getRecordData(collectionName, recordID)
		if err != nil {
			logger.LogWarning(fmt.Sprintf("Failed to get record data for %s: %v", recordID, err))
			data = make(map[string]interface{})
		}

		results = append(results, VectorSearchResult{
			ID:         recordID,
			Collection: collectionName,
			Data:       data,
			Score:      score,
			Distance:   distance,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over search results: %w", err)
	}

	return results, nil
}

// GetEmbedding retrieves an embedding by ID
func (s *SQLiteVecStore) GetEmbedding(ctx context.Context, id string) (*VectorEmbedding, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.initialized {
		return nil, ErrStoreNotInitialized
	}

	var (
		collectionID string
		recordID     string
		metadataStr  string
		created      time.Time
		updated      time.Time
	)

	// Get the embedding metadata
	err := s.db.QueryRowContext(ctx, `
		SELECT collection_id, record_id, metadata, created, updated
		FROM _vector_embeddings
		WHERE id = ?
	`, id).Scan(&collectionID, &recordID, &metadataStr, &created, &updated)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("%w: embedding %s not found", ErrRecordNotFound, id)
		}
		return nil, fmt.Errorf("failed to retrieve embedding metadata: %w", err)
	}

	// Parse metadata
	var metadata Metadata
	if err := json.Unmarshal([]byte(metadataStr), &metadata); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	// Get the vector data
	var vectorStr string
	err = s.db.QueryRowContext(ctx, fmt.Sprintf(`
		SELECT embedding
		FROM %s_vec
		WHERE id = ?
	`, collectionID), id).Scan(&vectorStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("%w: vector data for embedding %s not found", ErrRecordNotFound, id)
		}
		return nil, fmt.Errorf("failed to retrieve vector data: %w", err)
	}

	// Parse vector
	vector, err := UnmarshalVector(vectorStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse vector: %w", err)
	}

	return &VectorEmbedding{
		ID:           id,
		CollectionID: collectionID,
		RecordID:     recordID,
		Vector:       vector,
		Metadata:     metadata,
		Created:      created,
		Updated:      updated,
	}, nil
}

// GetEmbeddingsForRecord retrieves all embeddings for a record
func (s *SQLiteVecStore) GetEmbeddingsForRecord(ctx context.Context, collectionName, recordID string) ([]*VectorEmbedding, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.initialized {
		return nil, ErrStoreNotInitialized
	}

	// Check if the collection is registered
	if _, exists := s.registeredCollections[collectionName]; !exists {
		return nil, fmt.Errorf("%w: collection %s not registered for vector search", ErrCollectionNotFound, collectionName)
	}

	// Get the embedding IDs for this record
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, metadata, created, updated
		FROM _vector_embeddings
		WHERE collection_id = ? AND record_id = ?
	`, collectionName, recordID)
	if err != nil {
		return nil, fmt.Errorf("failed to query embeddings: %w", err)
	}
	defer rows.Close()

	var embeddings []*VectorEmbedding
	for rows.Next() {
		var (
			id         string
			metadataStr string
			created    time.Time
			updated    time.Time
		)

		if err := rows.Scan(&id, &metadataStr, &created, &updated); err != nil {
			return nil, fmt.Errorf("failed to scan embedding row: %w", err)
		}

		// Parse metadata
		var metadata Metadata
		if err := json.Unmarshal([]byte(metadataStr), &metadata); err != nil {
			return nil, fmt.Errorf("failed to parse metadata: %w", err)
		}

		// Get the vector data
		var vectorStr string
		err = s.db.QueryRowContext(ctx, fmt.Sprintf(`
			SELECT embedding
			FROM %s_vec
			WHERE id = ?
		`, collectionName), id).Scan(&vectorStr)
		if err != nil {
			if err == sql.ErrNoRows {
				// Skip if vector not found
				continue
			}
			return nil, fmt.Errorf("failed to retrieve vector data: %w", err)
		}

		// Parse vector
		vector, err := UnmarshalVector(vectorStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse vector: %w", err)
		}

		embeddings = append(embeddings, &VectorEmbedding{
			ID:           id,
			CollectionID: collectionName,
			RecordID:     recordID,
			Vector:       vector,
			Metadata:     metadata,
			Created:      created,
			Updated:      updated,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over embeddings: %w", err)
	}

	return embeddings, nil
}

// Name returns the store name
func (s *SQLiteVecStore) Name() string {
	return "sqlite"
}

// Helper to get record data from the original collection
func (s *SQLiteVecStore) getRecordData(collectionName, recordID string) (map[string]interface{}, error) {
	// Use direct SQL query to get the data from the record
	query := fmt.Sprintf("SELECT json_extract(data, '$') FROM %s WHERE id = ?", collectionName)
	var jsonData string
	err := s.db.QueryRowContext(context.Background(), query, recordID).Scan(&jsonData)
	if err != nil {
		return nil, fmt.Errorf("failed to get record data: %w", err)
	}

	// Parse the JSON data
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
		return nil, fmt.Errorf("failed to parse record data: %w", err)
	}

	return data, nil
} 