package vectorsearch

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/util"
)

// VectorSearchService provides vector search capabilities using SQLite-Vec
type VectorSearchService struct {
	app              *pocketbase.PocketBase
	embedder         EmbeddingProvider
	vectorStore      VectorStore
	collectionConfig map[string]*CollectionConfig
	initialized      bool
	mu               sync.RWMutex
}

// CollectionConfig contains settings for a collection's vector search
type CollectionConfig struct {
	Fields     []string `json:"fields"`     // Fields to include in the embedding
	Dimensions int      `json:"dimensions"` // Vector dimensions
}

// ServiceOptions contains configuration options for the vector search service
type ServiceOptions struct {
	Provider      ProviderOptions              `json:"provider"`
	Store         VectorStoreOptions           `json:"store"`
	Collections   map[string]*CollectionConfig `json:"collections"`
	DefaultFields []string                     `json:"defaultFields"`
}

// NewVectorSearchService creates a new vector search service
func NewVectorSearchService(app *pocketbase.PocketBase, options ServiceOptions) (*VectorSearchService, error) {
	if app == nil {
		return nil, errors.New("app is required")
	}

	// Create the service
	service := &VectorSearchService{
		app:              app,
		collectionConfig: make(map[string]*CollectionConfig),
	}

	// Configure collections
	if options.Collections != nil {
		for collName, config := range options.Collections {
			service.collectionConfig[collName] = config
		}
	}

	return service, nil
}

// Initialize sets up the vector search service
func (s *VectorSearchService) Initialize(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.initialized {
		return nil
	}

	logger.LogInfo("Initializing vector search service")

	// Get the database connection
	dbConn := getDBConn(s.app)
	if dbConn == nil {
		return errors.New("failed to get database connection")
	}

	// Create and initialize the vector store
	storeOptions := VectorStoreOptions{
		Dimensions:       768, // Default
		IndexType:        "flat",
		DistanceMetric:   "cosine",
		DefaultThreshold: 0.75,
	}

	var err error
	storeFactory, ok := GetStoreFactory("sqlite")
	if !ok {
		return errors.New("SQLite vector store not registered")
	}

	s.vectorStore, err = storeFactory(dbConn, storeOptions)
	if err != nil {
		return fmt.Errorf("failed to create vector store: %w", err)
	}

	if err := s.vectorStore.Initialize(ctx); err != nil {
		return fmt.Errorf("failed to initialize vector store: %w", err)
	}

	// Create and initialize the embedding provider
	providerOptions := ProviderOptions{
		APIKey:     util.GetEnv("GOOGLE_API_KEY", ""),
		Model:      "text-embedding-004",
		Dimensions: 768,
	}

	providerFactory, ok := GetProviderFactory("google")
	if !ok {
		return errors.New("Google embedding provider not registered")
	}

	s.embedder, err = providerFactory(providerOptions)
	if err != nil {
		return fmt.Errorf("failed to create embedding provider: %w", err)
	}

	if err := s.embedder.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize embedding provider: %w", err)
	}

	// Register the hooks for record lifecycle
	s.registerHooks()

	// Register the API routes
	s.registerRoutes()

	s.initialized = true
	logger.LogInfo("Vector search service initialized successfully")
	return nil
}

// RegisterCollection registers a collection for vector search
func (s *VectorSearchService) RegisterCollection(ctx context.Context, collectionName string, fields []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return errors.New("service not initialized")
	}

	// Check if the collection exists
	_, err := s.app.Dao().FindCollectionByNameOrId(collectionName)
	if err != nil {
		return fmt.Errorf("collection not found: %w", err)
	}

	// Register with the vector store
	if err := s.vectorStore.RegisterCollection(ctx, collectionName, fields); err != nil {
		return fmt.Errorf("failed to register collection: %w", err)
	}

	// Store the configuration
	s.collectionConfig[collectionName] = &CollectionConfig{
		Fields:     fields,
		Dimensions: s.embedder.Dimensions(),
	}

	logger.LogInfo(fmt.Sprintf("Registered collection %s for vector search with fields: %s",
		collectionName, strings.Join(fields, ", ")))

	return nil
}

// UnregisterCollection removes a collection from vector search
func (s *VectorSearchService) UnregisterCollection(ctx context.Context, collectionName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return errors.New("service not initialized")
	}

	// Unregister from the vector store
	if err := s.vectorStore.UnregisterCollection(ctx, collectionName); err != nil {
		return fmt.Errorf("failed to unregister collection: %w", err)
	}

	// Remove from configuration
	delete(s.collectionConfig, collectionName)

	logger.LogInfo(fmt.Sprintf("Unregistered collection %s from vector search", collectionName))
	return nil
}

// SearchCollection performs a vector search in a collection
func (s *VectorSearchService) SearchCollection(ctx context.Context, collectionName, query string, page, perPage int, threshold float64) ([]VectorSearchResult, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.initialized {
		return nil, 0, errors.New("service not initialized")
	}

	// Check if the collection is registered
	if _, exists := s.collectionConfig[collectionName]; !exists {
		return nil, 0, fmt.Errorf("collection %s not registered for vector search", collectionName)
	}

	// Generate embedding for the query
	embedding, err := s.embedder.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Search for similar vectors
	limit := perPage
	if limit <= 0 {
		limit = 10
	}

	results, err := s.vectorStore.SearchSimilar(ctx, collectionName, embedding, limit, threshold)
	if err != nil {
		return nil, 0, fmt.Errorf("search failed: %w", err)
	}

	// Count the total results
	totalCount := len(results) // Simplified count approach

	return results, totalCount, nil
}

// SearchMultipleCollections searches across multiple registered collections
func (s *VectorSearchService) SearchMultipleCollections(ctx context.Context, query string, collections []string, page, perPage int, threshold float64) ([]VectorSearchResult, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.initialized {
		return nil, 0, errors.New("service not initialized")
	}

	// If no collections specified, search all registered collections
	if len(collections) == 0 {
		for collection := range s.collectionConfig {
			collections = append(collections, collection)
		}
	}

	// Validate that all collections are registered
	for _, collection := range collections {
		if _, exists := s.collectionConfig[collection]; !exists {
			return nil, 0, fmt.Errorf("collection %s not registered for vector search", collection)
		}
	}

	// Generate embedding for the query
	embedding, err := s.embedder.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Search each collection
	var allResults []VectorSearchResult
	for _, collection := range collections {
		results, err := s.vectorStore.SearchSimilar(ctx, collection, embedding, perPage, threshold)
		if err != nil {
			logger.LogWarning(fmt.Sprintf("Error searching collection %s: %v", collection, err))
			continue
		}
		allResults = append(allResults, results...)
	}

	// Sort results by score (descending)
	util.SortVectorSearchResults(allResults)

	// Apply pagination
	totalCount := len(allResults)
	start := (page - 1) * perPage
	if start < 0 {
		start = 0
	}
	end := start + perPage
	if end > totalCount {
		end = totalCount
	}

	// If start is beyond the total count, return empty results
	if start >= totalCount {
		return []VectorSearchResult{}, totalCount, nil
	}

	return allResults[start:end], totalCount, nil
}

// IndexRecord generates and stores embeddings for a record
func (s *VectorSearchService) IndexRecord(ctx context.Context, collectionName, recordID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return errors.New("service not initialized")
	}

	// Check if the collection is registered
	config, exists := s.collectionConfig[collectionName]
	if !exists {
		return fmt.Errorf("collection %s not registered for vector search", collectionName)
	}

	// Get the record data
	record, err := s.app.Dao().FindRecordById(collectionName, recordID)
	if err != nil {
		return fmt.Errorf("record not found: %w", err)
	}

	// Extract text from the configured fields
	var textToEmbed strings.Builder
	for _, field := range config.Fields {
		if val, ok := record.Get(field).(string); ok && val != "" {
			textToEmbed.WriteString(val)
			textToEmbed.WriteString("\n")
		}
	}

	// Skip if no content to embed
	if textToEmbed.Len() == 0 {
		logger.LogInfo(fmt.Sprintf("No content to embed for record %s in collection %s", recordID, collectionName))
		return nil
	}

	// Generate embedding
	embedding, err := s.embedder.GenerateEmbedding(ctx, textToEmbed.String())
	if err != nil {
		return fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Create metadata
	metadata := Metadata{
		Fields:    config.Fields,
		FieldData: make(map[string]interface{}),
	}
	for _, field := range config.Fields {
		metadata.FieldData[field] = record.Get(field)
	}

	// Delete existing embeddings for this record
	if err := s.vectorStore.DeleteAllEmbeddingsForRecord(ctx, collectionName, recordID); err != nil {
		logger.LogWarning(fmt.Sprintf("Failed to delete existing embeddings: %v", err))
	}

	// Store the embedding
	_, err = s.vectorStore.StoreEmbedding(ctx, collectionName, recordID, embedding, metadata)
	if err != nil {
		return fmt.Errorf("failed to store embedding: %w", err)
	}

	logger.LogInfo(fmt.Sprintf("Indexed record %s in collection %s", recordID, collectionName))
	return nil
}

// DeleteRecordEmbeddings removes all embeddings for a record
func (s *VectorSearchService) DeleteRecordEmbeddings(ctx context.Context, collectionName, recordID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return errors.New("service not initialized")
	}

	// Check if the collection is registered
	if _, exists := s.collectionConfig[collectionName]; !exists {
		return fmt.Errorf("collection %s not registered for vector search", collectionName)
	}

	// Delete the embeddings
	if err := s.vectorStore.DeleteAllEmbeddingsForRecord(ctx, collectionName, recordID); err != nil {
		return fmt.Errorf("failed to delete embeddings: %w", err)
	}

	logger.LogInfo(fmt.Sprintf("Deleted embeddings for record %s in collection %s", recordID, collectionName))
	return nil
}

// registerHooks sets up hooks for record lifecycle events
func (s *VectorSearchService) registerHooks() {
	// Record created
	s.app.OnModelAfterCreate().Add(func(e *core.ModelEvent) error {
		record, ok := e.Model.(*core.Record)
		if !ok {
			return nil
		}

		collectionName := record.Collection().Name
		if _, exists := s.collectionConfig[collectionName]; exists {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				if err := s.IndexRecord(ctx, collectionName, record.Id); err != nil {
					logger.LogError(fmt.Sprintf("Failed to index new record: %v", err))
				}
			}()
		}
		return nil
	})

	// Record updated
	s.app.OnModelAfterUpdate().Add(func(e *core.ModelEvent) error {
		record, ok := e.Model.(*core.Record)
		if !ok {
			return nil
		}

		collectionName := record.Collection().Name
		if _, exists := s.collectionConfig[collectionName]; exists {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				if err := s.IndexRecord(ctx, collectionName, record.Id); err != nil {
					logger.LogError(fmt.Sprintf("Failed to update record index: %v", err))
				}
			}()
		}
		return nil
	})

	// Record deleted
	s.app.OnModelAfterDelete().Add(func(e *core.ModelEvent) error {
		record, ok := e.Model.(*core.Record)
		if !ok {
			return nil
		}

		collectionName := record.Collection().Name
		if _, exists := s.collectionConfig[collectionName]; exists {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				if err := s.DeleteRecordEmbeddings(ctx, collectionName, record.Id); err != nil {
					logger.LogError(fmt.Sprintf("Failed to delete record embeddings: %v", err))
				}
			}()
		}
		return nil
	})

	// Collection deleted
	s.app.OnModelAfterDelete().Add(func(e *core.ModelEvent) error {
		collection, ok := e.Model.(*models.Collection)
		if !ok {
			return nil
		}

		collectionName := collection.Name
		if _, exists := s.collectionConfig[collectionName]; exists {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				if err := s.UnregisterCollection(ctx, collectionName); err != nil {
					logger.LogError(fmt.Sprintf("Failed to unregister collection: %v", err))
				}
			}()
		}
		return nil
	})
}

// registerRoutes sets up API routes for vector search
func (s *VectorSearchService) registerRoutes() {
	s.app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Vector search in a specific collection
		e.Router.AddRoute(echo.Route{
			Method: "POST",
			Path:   "/api/collections/:collection/vector-search",
			Handler: func(c echo.Context) error {
				collection := c.PathParam("collection")

				// Parse request body
				var options VectorSearchOptions
				if err := c.Bind(&options); err != nil {
					return apis.NewBadRequestError("Invalid search options", err)
				}

				// Set defaults
				if options.Page <= 0 {
					options.Page = 1
				}
				if options.PerPage <= 0 {
					options.PerPage = 10
				}

				// Perform search
				ctx := c.Request().Context()
				results, total, err := s.SearchCollection(ctx, collection, options.Query, options.Page, options.PerPage, options.Threshold)
				if err != nil {
					return apis.NewBadRequestError("Search failed", err)
				}

				// Format response
				totalPages := (total + options.PerPage - 1) / options.PerPage
				response := map[string]interface{}{
					"items":      results,
					"page":       options.Page,
					"perPage":    options.PerPage,
					"totalItems": total,
					"totalPages": totalPages,
				}

				return c.JSON(200, response)
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(s.app),
				apis.RequireAdminOrRecordAuth(),
			},
		})

		// Vector search across multiple collections
		e.Router.AddRoute(echo.Route{
			Method: "POST",
			Path:   "/api/vector-search",
			Handler: func(c echo.Context) error {
				// Parse request body
				var options VectorSearchOptions
				if err := c.Bind(&options); err != nil {
					return apis.NewBadRequestError("Invalid search options", err)
				}

				// Set defaults
				if options.Page <= 0 {
					options.Page = 1
				}
				if options.PerPage <= 0 {
					options.PerPage = 10
				}

				// Perform search
				ctx := c.Request().Context()
				results, total, err := s.SearchMultipleCollections(ctx, options.Query, options.Collections, options.Page, options.PerPage, options.Threshold)
				if err != nil {
					return apis.NewBadRequestError("Search failed", err)
				}

				// Format response
				totalPages := (total + options.PerPage - 1) / options.PerPage
				response := map[string]interface{}{
					"items":      results,
					"page":       options.Page,
					"perPage":    options.PerPage,
					"totalItems": total,
					"totalPages": totalPages,
				}

				return c.JSON(200, response)
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(s.app),
				apis.RequireAdminOrRecordAuth(),
			},
		})

		// Manually index a record
		e.Router.AddRoute(echo.Route{
			Method: "POST",
			Path:   "/api/collections/:collection/records/:recordId/index",
			Handler: func(c echo.Context) error {
				collection := c.PathParam("collection")
				recordID := c.PathParam("recordId")

				// Reindex the record
				ctx := c.Request().Context()
				if err := s.IndexRecord(ctx, collection, recordID); err != nil {
					return apis.NewBadRequestError("Failed to index record", err)
				}

				return c.JSON(200, map[string]interface{}{
					"success": true,
					"message": "Record indexed successfully",
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(s.app),
				apis.RequireAdminAuth(),
			},
		})

		// Register a collection for vector search
		e.Router.AddRoute(echo.Route{
			Method: "POST",
			Path:   "/api/collections/:collection/register",
			Handler: func(c echo.Context) error {
				collection := c.PathParam("collection")

				// Parse request body
				var config CollectionConfig
				if err := c.Bind(&config); err != nil {
					return apis.NewBadRequestError("Invalid configuration", err)
				}

				// Register the collection
				ctx := c.Request().Context()
				if err := s.RegisterCollection(ctx, collection, config.Fields); err != nil {
					return apis.NewBadRequestError("Failed to register collection", err)
				}

				return c.JSON(200, map[string]interface{}{
					"success": true,
					"message": "Collection registered successfully",
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(s.app),
				apis.RequireAdminAuth(),
			},
		})

		// Unregister a collection from vector search
		e.Router.AddRoute(echo.Route{
			Method: "POST",
			Path:   "/api/collections/:collection/unregister",
			Handler: func(c echo.Context) error {
				collection := c.PathParam("collection")

				// Unregister the collection
				ctx := c.Request().Context()
				if err := s.UnregisterCollection(ctx, collection); err != nil {
					return apis.NewBadRequestError("Failed to unregister collection", err)
				}

				return c.JSON(200, map[string]interface{}{
					"success": true,
					"message": "Collection unregistered successfully",
				})
			},
			Middlewares: []echo.MiddlewareFunc{
				apis.ActivityLogger(s.app),
				apis.RequireAdminAuth(),
			},
		})

		return nil
	})
}

// Helper function to get the database connection
func getDBConn(app *pocketbase.PocketBase) *sql.DB {
	if app == nil || app.DB() == nil {
		return nil
	}

	db, err := app.DB().DB.DB()
	if err != nil {
		logger.LogError(fmt.Sprintf("Failed to get DB connection: %v", err))
		return nil
	}

	return db
}
