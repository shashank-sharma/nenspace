package vectorsearch

import (
	"context"
	"database/sql"
	"errors"
)

// Common errors for vector storage
var (
	ErrStoreNotInitialized  = errors.New("vector store not initialized")
	ErrCollectionNotFound   = errors.New("collection not found")
	ErrRecordNotFound       = errors.New("record not found")
	ErrInvalidConfiguration = errors.New("invalid configuration")
)

// VectorStore defines the interface for storing and retrieving vector embeddings
type VectorStore interface {
	// Initialize sets up the vector store with the required configuration
	Initialize(ctx context.Context) error
	
	// RegisterCollection registers a collection for vector search
	RegisterCollection(ctx context.Context, collectionName string, fields []string) error
	
	// UnregisterCollection removes a collection from vector search
	UnregisterCollection(ctx context.Context, collectionName string) error
	
	// StoreEmbedding stores an embedding for a record
	StoreEmbedding(ctx context.Context, collectionName, recordID string, vector []float32, metadata Metadata) (string, error)
	
	// UpdateEmbedding updates an existing embedding
	UpdateEmbedding(ctx context.Context, id string, vector []float32, metadata Metadata) error
	
	// DeleteEmbedding removes an embedding
	DeleteEmbedding(ctx context.Context, id string) error
	
	// DeleteAllEmbeddingsForRecord removes all embeddings for a record
	DeleteAllEmbeddingsForRecord(ctx context.Context, collectionName, recordID string) error
	
	// SearchSimilar finds similar vectors in a collection
	SearchSimilar(ctx context.Context, collectionName string, queryVector []float32, limit int, threshold float64) ([]VectorSearchResult, error)
	
	// GetEmbedding retrieves an embedding by ID
	GetEmbedding(ctx context.Context, id string) (*VectorEmbedding, error)
	
	// GetEmbeddingsForRecord retrieves all embeddings for a record
	GetEmbeddingsForRecord(ctx context.Context, collectionName, recordID string) ([]*VectorEmbedding, error)
	
	// Name returns the store name
	Name() string
}

// VectorStoreOptions contains configuration for vector stores
type VectorStoreOptions struct {
	Dimensions      int    `json:"dimensions"`
	IndexType       string `json:"indexType"`
	DistanceMetric  string `json:"distanceMetric"`
	DefaultThreshold float64 `json:"defaultThreshold"`
}

// VectorStoreFactory is a function type that creates vector stores
type VectorStoreFactory func(db *sql.DB, options VectorStoreOptions) (VectorStore, error)

// storeRegistry stores available vector store factories
var storeRegistry = make(map[string]VectorStoreFactory)

// RegisterStore adds a store factory to the registry
func RegisterStore(name string, factory VectorStoreFactory) {
	storeRegistry[name] = factory
}

// GetStoreFactory retrieves a store factory by name
func GetStoreFactory(name string) (VectorStoreFactory, bool) {
	factory, ok := storeRegistry[name]
	return factory, ok
} 