package search

import (
	"fmt"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/store"
)

// SearchResult represents a single search result
type SearchResult struct {
	ID         string                 `json:"id"`
	Data       map[string]interface{} `json:"data"`
	Collection string                 `json:"collection"`
	Rank       float64                `json:"rank"`
}

// SearchOptions contains parameters for a search operation
type SearchOptions struct {
	Query   string `json:"query"`
	Page    int    `json:"page"`
	PerPage int    `json:"perPage"`
}

// SearchResponse contains the results of a search operation with pagination details
type SearchResponse struct {
	Items      []map[string]interface{} `json:"items"`
	Page       int                      `json:"page"`
	PerPage    int                      `json:"perPage"`
	TotalItems int                      `json:"totalItems"`
	TotalPages int                      `json:"totalPages"`
}

// Column represents a database column
type Column struct {
	Name string
	Type string
}

// FullTextSearchService provides full-text search capabilities for specified collections
type FullTextSearchService struct {
	app              *pocketbase.PocketBase
	collections      []string
	skipColumns      map[string][]string
	forceRecreate    bool
}

// FullTextSearchOptions contains configuration for the search service
type FullTextSearchOptions struct {
	SkipColumns   map[string][]string
	ForceRecreate bool
}

// NewFullTextSearchService creates a new instance of FullTextSearchService
// with default options (no column skipping, no force recreation)
//
// Example:
//
//	service := NewFullTextSearchService(app, "posts", "comments", "users")
func NewFullTextSearchService(app *pocketbase.PocketBase, collections ...string) *FullTextSearchService {
	return &FullTextSearchService{
		app:              app,
		collections:      collections,
		skipColumns:      make(map[string][]string),
		forceRecreate:    false,
	}
}

// NewFullTextSearchServiceWithOptions creates a new instance of FullTextSearchService with custom options
//
// Example:
//
//	options := FullTextSearchOptions{
//	  SkipColumns: map[string][]string{
//	    "posts": {"created", "updated"},
//	    "users": {"password", "email"},
//	  },
//	  ForceRecreate: true,
//	}
//	service := NewFullTextSearchServiceWithOptions(app, options, "posts", "comments", "users")
func NewFullTextSearchServiceWithOptions(app *pocketbase.PocketBase, options FullTextSearchOptions, collections ...string) *FullTextSearchService {
	return &FullTextSearchService{
		app:              app,
		collections:      collections,
		skipColumns:      options.SkipColumns,
		forceRecreate:    options.ForceRecreate,
	}
}

// Initialize sets up FTS tables and triggers for all registered collections
func (s *FullTextSearchService) Initialize() error {
	logger.LogInfo("Initializing full-text search service")
	
	for _, collection := range s.collections {
		if s.forceRecreate {
			logger.LogInfo(fmt.Sprintf("Force recreate enabled, dropping FTS for collection %s", collection))
			if err := s.deleteCollectionFTS(collection); err != nil {
				logger.LogError(fmt.Sprintf("Failed to delete FTS for collection %s: %v", collection, err))
			}
		}
		
		if err := s.createCollectionFTS(collection); err != nil {
			logger.LogError(fmt.Sprintf("Failed to create FTS for collection %s: %v", collection, err))
			return fmt.Errorf("failed to initialize FTS for collection %s: %w", collection, err)
		}
	}
	
	return nil
}

// SetSkipColumns sets columns to skip for specific collections
//
// Example:
//
//	service.SetSkipColumns(map[string][]string{
//	  "posts": {"created", "updated"},
//	  "users": {"password", "email"},
//	})
func (s *FullTextSearchService) SetSkipColumns(collectionSkipMap map[string][]string) {
	s.skipColumns = collectionSkipMap
}

// SetForceRecreate sets whether to force recreate tables on initialization
func (s *FullTextSearchService) SetForceRecreate(forceRecreate bool) {
	s.forceRecreate = forceRecreate
}

// AddSkipColumnsForCollection adds columns to skip for a specific collection
// TODO: Think if removing created/updated columns
// Example: service.AddSkipColumnsForCollection("users", "password", "email", "token")
func (s *FullTextSearchService) AddSkipColumnsForCollection(collection string, columns ...string) {
	if s.skipColumns == nil {
		s.skipColumns = make(map[string][]string)
	}
	s.skipColumns[collection] = append(s.skipColumns[collection], columns...)
}

// createCollectionFTS creates FTS virtual table and triggers for a collection
func (s *FullTextSearchService) createCollectionFTS(collectionName string) error {
	_, err := store.GetDao().FindCollectionByNameOrId(collectionName)
	if err != nil {
		return fmt.Errorf("collection not found: %w", err)
	}
	
	logger.LogDebug(fmt.Sprintf("Creating FTS for collection: %s", collectionName))

	columns, err := s.getTableColumns(collectionName)
	if err != nil {
		return fmt.Errorf("failed to get table columns: %w", err)
	}

	skipColumns := make(map[string]bool)
	if cols, ok := s.skipColumns[collectionName]; ok {
		for _, col := range cols {
			skipColumns[col] = true
			logger.LogDebug(fmt.Sprintf("Will skip column %s for collection %s", col, collectionName))
		}
	}

	addedFields := make(map[string]bool)
	var fields []string
	
	if !skipColumns["id"] {
		fields = append(fields, "id")
		addedFields["id"] = true
	}
	
	for _, col := range columns {		
		if _, exists := addedFields[col.Name]; exists {
			logger.LogDebug(fmt.Sprintf("Skipping duplicate column %s", col.Name))
			continue
		}
		
		if skipColumns[col.Name] {
			logger.LogDebug(fmt.Sprintf("Skipping configured column %s", col.Name))
			continue
		}
		
		colType := strings.ToLower(col.Type)
		if strings.Contains(colType, "text") || 
		   strings.Contains(colType, "char") || 
		   strings.Contains(colType, "json") || 
		   strings.Contains(colType, "string") {
			logger.LogDebug(fmt.Sprintf("Adding column %s to FTS index", col.Name))
			fields = append(fields, col.Name)
			addedFields[col.Name] = true
		}
	}
	
	if len(fields) == 0 {
		return fmt.Errorf("no suitable columns found for FTS indexing in collection %s", collectionName)
	}

	exists, err := s.checkIfTableExists(collectionName + "_fts")
	if err != nil {
		return fmt.Errorf("error checking if FTS table exists: %w", err)
	}
	
	if exists {
		logger.LogDebug(fmt.Sprintf("FTS table for %s already exists", collectionName))
		return s.syncCollection(collectionName)
	}

	ftsQuery := fmt.Sprintf(
		"CREATE VIRTUAL TABLE %s_fts USING FTS5(%s, content=%s)",
		collectionName,
		strings.Join(fields, ", "),
		collectionName,
	)

	logger.LogDebug(fmt.Sprintf("Creating FTS table with SQL: %s", ftsQuery))
	if _, err := store.GetDao().DB().NewQuery(ftsQuery).Execute(); err != nil {
		return fmt.Errorf("failed to create FTS table: %w", err)
	}

	if err := s.createInsertTrigger(collectionName, fields); err != nil {
		return fmt.Errorf("failed to create insert trigger: %w", err)
	}

	if err := s.createUpdateTrigger(collectionName, fields); err != nil {
		return fmt.Errorf("failed to create update trigger: %w", err)
	}

	if err := s.createDeleteTrigger(collectionName, fields); err != nil {
		return fmt.Errorf("failed to create delete trigger: %w", err)
	}

	if err := s.syncCollection(collectionName); err != nil {
		return fmt.Errorf("failed to sync collection: %w", err)
	}
	
	logger.LogDebug(fmt.Sprintf("Successfully created FTS for collection %s", collectionName))
	return nil
}

// getTableColumns fetches column information from the database
func (s *FullTextSearchService) getTableColumns(tableName string) ([]Column, error) {
	var columns []Column
	
	rows := []dbx.NullStringMap{}
	err := store.GetDao().DB().
		NewQuery("PRAGMA table_info(" + tableName + ")").
		All(&rows)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get table info: %w", err)
	}

	for _, row := range rows {
		var name, typ string
		
		// Convert NullStringMap values to string
		if nameVal, ok := row["name"]; ok && nameVal.Valid {
			nameValue, err := nameVal.Value()
			if err == nil {
				name, _ = nameValue.(string)
			}
		}
		
		if typeVal, ok := row["type"]; ok && typeVal.Valid {
			typeValue, err := typeVal.Value()
			if err == nil {
				typ, _ = typeValue.(string)
			}
		}
		
		if name != "" {
			columns = append(columns, Column{
				Name: name,
				Type: typ,
			})
		}
	}
	
	return columns, nil
}

// createInsertTrigger creates an INSERT trigger for the FTS table
func (s *FullTextSearchService) createInsertTrigger(collectionName string, fields []string) error {
	var stmt strings.Builder
	
	stmt.WriteString(fmt.Sprintf("CREATE TRIGGER IF NOT EXISTS %s_fts_insert AFTER INSERT ON `%s` BEGIN ", collectionName, collectionName))
	stmt.WriteString(fmt.Sprintf("  INSERT INTO %s_fts(%s)", collectionName, strings.Join(fields, ", ")))
	stmt.WriteString(fmt.Sprintf("  VALUES (%s);", strings.Join(s.surroundFields(fields, "new.", ""), ", ")))
	stmt.WriteString("END;")

	logger.LogDebug(fmt.Sprintf("Creating INSERT trigger: %s", stmt.String()))
	if _, err := store.GetDao().DB().NewQuery(stmt.String()).Execute(); err != nil {
		return fmt.Errorf("failed to create INSERT trigger: %w", err)
	}
	return nil
}

// createUpdateTrigger creates an UPDATE trigger for the FTS table
func (s *FullTextSearchService) createUpdateTrigger(collectionName string, fields []string) error {
	var stmt strings.Builder
	
	stmt.WriteString(fmt.Sprintf("CREATE TRIGGER IF NOT EXISTS %s_fts_update AFTER UPDATE ON `%s` BEGIN ", collectionName, collectionName))
	stmt.WriteString(fmt.Sprintf("  INSERT INTO %s_fts(%s_fts, %s)", collectionName, collectionName, strings.Join(fields, ", ")))
	stmt.WriteString(fmt.Sprintf("  VALUES ('delete', %s);", strings.Join(s.surroundFields(fields, "old.", ""), ", ")))
	stmt.WriteString(fmt.Sprintf("  INSERT INTO %s_fts(%s)", collectionName, strings.Join(fields, ", ")))
	stmt.WriteString(fmt.Sprintf("  VALUES (%s);", strings.Join(s.surroundFields(fields, "new.", ""), ", ")))
	stmt.WriteString("END;")

	logger.LogDebug(fmt.Sprintf("Creating UPDATE trigger: %s", stmt.String()))
	if _, err := store.GetDao().DB().NewQuery(stmt.String()).Execute(); err != nil {
		return fmt.Errorf("failed to create UPDATE trigger: %w", err)
	}
	return nil
}

// createDeleteTrigger creates a DELETE trigger for the FTS table
func (s *FullTextSearchService) createDeleteTrigger(collectionName string, fields []string) error {
	var stmt strings.Builder
	
	stmt.WriteString(fmt.Sprintf("CREATE TRIGGER IF NOT EXISTS %s_fts_delete AFTER DELETE ON `%s` BEGIN ", collectionName, collectionName))
	stmt.WriteString(fmt.Sprintf("  INSERT INTO %s_fts(%s_fts, %s)", collectionName, collectionName, strings.Join(fields, ", ")))
	stmt.WriteString(fmt.Sprintf("  VALUES ('delete', %s);", strings.Join(s.surroundFields(fields, "old.", ""), ", ")))
	stmt.WriteString("END;")

	logger.LogDebug(fmt.Sprintf("Creating DELETE trigger: %s", stmt.String()))
	if _, err := store.GetDao().DB().NewQuery(stmt.String()).Execute(); err != nil {
		return fmt.Errorf("failed to create DELETE trigger: %w", err)
	}
	return nil
}

// deleteCollectionFTS removes the FTS virtual table and its triggers
func (s *FullTextSearchService) deleteCollectionFTS(collectionName string) error {
	exists, err := s.checkIfTableExists(collectionName + "_fts")
	if err != nil {
		return fmt.Errorf("error checking if FTS table exists: %w", err)
	}
	
	if !exists {
		logger.LogDebug(fmt.Sprintf("No FTS table found for %s, nothing to delete", collectionName))
		return nil
	}

	triggers := []string{
		fmt.Sprintf("DROP TRIGGER IF EXISTS %s_fts_insert", collectionName),
		fmt.Sprintf("DROP TRIGGER IF EXISTS %s_fts_update", collectionName),
		fmt.Sprintf("DROP TRIGGER IF EXISTS %s_fts_delete", collectionName),
	}

	for _, trigger := range triggers {
		if _, err := store.GetDao().DB().NewQuery(trigger).Execute(); err != nil {
			return fmt.Errorf("failed to drop trigger: %w", err)
		}
	}

	if _, err := store.GetDao().DB().NewQuery(fmt.Sprintf("DROP TABLE IF EXISTS %s_fts", collectionName)).Execute(); err != nil {
		return fmt.Errorf("failed to drop FTS table: %w", err)
	}

	logger.LogDebug(fmt.Sprintf("Successfully deleted FTS for collection %s", collectionName))
	return nil
}

// syncCollection rebuilds the FTS index for a collection
func (s *FullTextSearchService) syncCollection(collectionName string) error {
	var stmt strings.Builder
	stmt.WriteString(fmt.Sprintf("INSERT INTO %s_fts(%s_fts) VALUES('rebuild');", collectionName, collectionName))

	logger.LogDebug(fmt.Sprintf("Rebuilding FTS index for %s", collectionName))
	if _, err := store.GetDao().DB().NewQuery(stmt.String()).Execute(); err != nil {
		return fmt.Errorf("failed to rebuild FTS index: %w", err)
	}

	return nil
}

// SearchCollection performs a full-text search on a collection with pagination
func (s *FullTextSearchService) SearchCollection(collectionName string, query string, page, perPage int) ([]map[string]interface{}, int, error) {
	if !s.isCollectionSearchable(collectionName) {
		return nil, 0, fmt.Errorf("collection %s is not searchable or does not exist", collectionName)
	}

	if query == "" {
		return []map[string]interface{}{}, 0, nil
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	} else if perPage > 100 {
		perPage = 100
	}
	offset := (page - 1) * perPage

	var queryBuilder strings.Builder
	queryBuilder.WriteString("SELECT * ")
	queryBuilder.WriteString(fmt.Sprintf("FROM %s_fts ", collectionName))
	queryBuilder.WriteString("WHERE ")
	queryBuilder.WriteString(fmt.Sprintf("%s_fts MATCH {:query} ", collectionName))
	queryBuilder.WriteString("ORDER BY rank ")
	queryBuilder.WriteString(fmt.Sprintf("LIMIT %d OFFSET %d", perPage, offset))

	results := []dbx.NullStringMap{}
	err := store.GetDao().DB().
		NewQuery(queryBuilder.String()).
		Bind(dbx.Params{"query": query}).
		All(&results)

	if err != nil {
		return nil, 0, fmt.Errorf("search query failed: %w", err)
	}

	totalCount, err := s.countSearchResults(collectionName, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	items := make([]map[string]interface{}, len(results))
	for i, result := range results {
		item := make(map[string]interface{})
		for key, val := range result {
			value, err := val.Value()
			if err != nil || !val.Valid {
				item[key] = nil
			} else {
				item[key] = value
			}
		}
		items[i] = item
	}

	return items, totalCount, nil
}

// countSearchResults counts the total number of matching results for a search query
func (s *FullTextSearchService) countSearchResults(collectionName, query string) (int, error) {
	var totalCount int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s_fts WHERE %s_fts MATCH {:query}", 
		collectionName, collectionName)
	
	err := store.GetDao().DB().
		NewQuery(countQuery).
		Bind(dbx.Params{"query": query}).
		Row(&totalCount)

	if err != nil {
		return 0, fmt.Errorf("count query failed: %w", err)
	}
	
	return totalCount, nil
}

// isCollectionSearchable checks if a collection exists and has FTS enabled
func (s *FullTextSearchService) isCollectionSearchable(collectionName string) bool {
	// Check if the collection is in our list of searchable collections
	found := false
	for _, col := range s.collections {
		if col == collectionName {
			found = true
			break
		}
	}

	if !found {
		return false
	}

	_, err := store.GetDao().FindCollectionByNameOrId(collectionName)
	if err != nil {
		logger.LogError(fmt.Sprintf("Collection %s not found: %v", collectionName, err))
		return false
	}

	exists, err := s.checkIfTableExists(collectionName + "_fts")
	if err != nil {
		logger.LogError(fmt.Sprintf("Error checking if FTS table exists for %s: %v", collectionName, err))
		return false
	}
	
	return exists
}

// checkIfTableExists checks if a table exists in the database
func (s *FullTextSearchService) checkIfTableExists(tableName string) (bool, error) {
	var count int
	err := store.GetDao().DB().
		NewQuery("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name={:name}").
		Bind(dbx.Params{"name": tableName}).
		Row(&count)

	if err != nil {
		return false, fmt.Errorf("failed to check if table exists: %w", err)
	}

	return count > 0, nil
}

// surroundFields prefixes and/or suffixes each field name in the list
func (s *FullTextSearchService) surroundFields(fields []string, prefix, suffix string) []string {
	result := make([]string, len(fields))
	for i, field := range fields {
		result[i] = prefix + field + suffix
	}
	return result
}

// GetSupportedCollections returns the list of collections that are configured for full-text search
func (s *FullTextSearchService) GetSupportedCollections() []string {
	return s.collections
}

// CreateCollectionFTS creates FTS virtual table and triggers for a collection
// This is a public wrapper for createCollectionFTS
func (s *FullTextSearchService) CreateCollectionFTS(collectionName string) error {
	return s.createCollectionFTS(collectionName)
}

// DeleteCollectionFTS removes the FTS virtual table and its triggers
// This is a public wrapper for deleteCollectionFTS
func (s *FullTextSearchService) DeleteCollectionFTS(collectionName string) error {
	return s.deleteCollectionFTS(collectionName)
}

// PrepareSearchResponse creates a formatted search response with pagination info
func (s *FullTextSearchService) PrepareSearchResponse(items []map[string]interface{}, totalItems, page, perPage int) SearchResponse {
	totalPages := (totalItems + perPage - 1) / perPage
	if totalPages < 1 {
		totalPages = 1
	}
	
	return SearchResponse{
		Items:      items,
		Page:       page,
		PerPage:    perPage,
		TotalItems: totalItems,
		TotalPages: totalPages,
	}
} 