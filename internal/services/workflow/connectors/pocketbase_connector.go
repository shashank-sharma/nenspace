package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

// PocketBaseConnector is a PocketBase source connector
type PocketBaseConnector struct {
	types.BaseConnector
}

// NewPocketBaseSourceConnector creates a new PocketBase source connector
func NewPocketBaseSourceConnector() types.Connector {
	configSchema := map[string]interface{}{
		"collection": map[string]interface{}{
			"type":        "string",
			"title":       "Collection",
			"description": "Name of the PocketBase collection to read from",
			"required":    true,
		},
		"filter": map[string]interface{}{
			"type":        "string",
			"title":       "Filter",
			"description": "Filter expression for the records (e.g. created > '2023-01-01')",
			"required":    false,
		},
		"sort": map[string]interface{}{
			"type":        "string",
			"title":       "Sort",
			"description": "Sort expression for the records (e.g. -created,title)",
			"default":     "-created",
			"required":    false,
		},
		"batch_size": map[string]interface{}{
			"type":        "number",
			"title":       "Batch Size",
			"description": "Number of records to fetch per batch (default: 100, max: 500)",
			"default":     100,
			"minimum":     1,
			"maximum":     500,
		},
		"max_records": map[string]interface{}{
			"type":        "number",
			"title":       "Max Records",
			"description": "Maximum number of records to retrieve (0 for unlimited)",
			"default":     1000,
		},
		"ignore_user_filter": map[string]interface{}{
			"type":        "boolean",
			"title":       "Ignore User Filter",
			"description": "If true, will not apply user-based filtering (use with caution)",
			"default":     false,
		},
	}

	connector := &PocketBaseConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "pocketbase_source",
			ConnName:     "PocketBase Source",
			ConnType:     types.SourceConnector,
			ConfigSchema: configSchema,
			Config:       make(map[string]interface{}),
		},
	}
	return connector
}

// getUserIDFromContext extracts the user ID from the context
func (c *PocketBaseConnector) getUserIDFromContext(ctx context.Context) string {
	// Use the standard util function to get user ID from context
	userID, ok := util.GetUserIDFromContext(ctx)
	if !ok {
		return ""
	}
	return userID
}

// Execute fetches data from PocketBase with batching and pagination
func (c *PocketBaseConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	// Get configuration values
	collectionName, ok := c.Config["collection"].(string)
	if !ok || collectionName == "" {
		return nil, fmt.Errorf("collection name is required")
	}

	userID := c.getUserIDFromContext(ctx)
	if userID == "" {
		return nil, fmt.Errorf("user ID not found in context")
	}

	// Check if we should ignore user filtering
	ignoreUserFilter := false
	if val, ok := c.Config["ignore_user_filter"].(bool); ok {
		ignoreUserFilter = val
	}

	// Get optional configuration values with defaults
	batchSize := 100
	if val, ok := c.Config["batch_size"].(float64); ok {
		batchSize = int(val)
	}
	if batchSize > 500 {
		batchSize = 500 // Enforce maximum batch size
	}

	maxRecords := 1000
	if val, ok := c.Config["max_records"].(float64); ok {
		maxRecords = int(val)
	}

	// Build the user filter condition
	userFilter := fmt.Sprintf("user = '%s'", userID)

	// Get and process the user-provided filter
	filter := ""
	if val, ok := c.Config["filter"].(string); ok {
		filter = val
	}

	// Combine user filter with the provided filter if not ignoring user filter
	if !ignoreUserFilter {
		if filter != "" {
			filter = fmt.Sprintf("(%s) AND %s", filter, userFilter)
		} else {
			filter = userFilter
		}
	}

	// Handle sort parameter
	sort := "created DESC" // Default sort
	if val, ok := c.Config["sort"].(string); ok && val != "" {
		// Convert PocketBase sort format to SQL format
		fields := strings.Split(val, ",")
		sortParts := make([]string, 0, len(fields))

		for _, field := range fields {
			field = strings.TrimSpace(field)
			if field == "" {
				continue
			}

			if strings.HasPrefix(field, "-") {
				// Remove the "-" prefix and add "DESC"
				sortParts = append(sortParts, fmt.Sprintf("%s DESC", strings.TrimPrefix(field, "-")))
			} else {
				// If no "-" prefix, use "ASC"
				sortParts = append(sortParts, fmt.Sprintf("%s ASC", field))
			}
		}

		if len(sortParts) > 0 {
			sort = strings.Join(sortParts, ", ")
		}
	}

	// Initialize variables for pagination
	offset := 0
	totalRecords := 0
	allRecords := make([]map[string]interface{}, 0)

	// Get PocketBase instance
	pb := store.GetDao()
	if pb == nil {
		return nil, fmt.Errorf("failed to get PocketBase instance")
	}

	// Start fetching data in batches
	for {
		// Check if we've reached the maximum records
		if maxRecords > 0 && totalRecords >= maxRecords {
			break
		}

		// Calculate the current batch size
		currentBatchSize := batchSize
		if maxRecords > 0 && (totalRecords+batchSize) > maxRecords {
			currentBatchSize = maxRecords - totalRecords
		}

		// Build the query
		query := pb.DB().Select("*").From(collectionName)

		// Apply filter if specified
		if filter != "" {
			query.AndWhere(dbx.NewExp(filter))
		}

		// Apply sorting
		query.OrderBy(sort)

		// Apply pagination
		query.Limit(int64(currentBatchSize))
		query.Offset(int64(offset))

		// Execute query with proper type
		var dbxRecords []dbx.NullStringMap
		if err := query.All(&dbxRecords); err != nil {
			return nil, fmt.Errorf("failed to query records: %w", err)
		}

		// Break if no more records
		if len(dbxRecords) == 0 {
			break
		}

		// Process records
		for _, dbxRecord := range dbxRecords {
			record := make(map[string]interface{})

			// Convert NullStringMap to regular map
			for key, value := range dbxRecord {
				if value.Valid {
					record[key] = value.String
				} else {
					record[key] = nil
				}
			}

			// Clean up system fields if present
			delete(record, "collectionId")
			delete(record, "collectionName")
			delete(record, "expand")

			// Add the record to our results
			allRecords = append(allRecords, record)
		}

		// Update counters
		totalRecords += len(dbxRecords)
		offset += len(dbxRecords)

		// Log progress
		logger.Info.Printf("Fetched %d records from collection %s (total: %d)", len(dbxRecords), collectionName, totalRecords)

		// Break if we got fewer records than requested (last page)
		if len(dbxRecords) < currentBatchSize {
			break
		}
	}

	// Get collection schema for metadata
	nodeID := c.ID()
	schema := c.getCollectionSchemaWithSource(collectionName, nodeID)

	// Build envelope with schema metadata
	envelope := &types.DataEnvelope{
		Data: allRecords,
		Metadata: types.Metadata{
			NodeID:          nodeID,
			NodeType:        c.ConnID,
			RecordCount:     totalRecords,
			ExecutionTimeMs: 0,
			Schema:          schema,
			Sources:         []string{nodeID},
			Custom: map[string]interface{}{
				"collection":  collectionName,
				"filter":      filter,
				"sort":        sort,
				"batch_size":  batchSize,
				"max_records": maxRecords,
				"user":        userID,
			},
		},
	}

	return envelope.ToMap(), nil
}

// GetOutputSchema returns the schema for the PocketBase collection
func (c *PocketBaseConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if inputSchema != nil {
		return nil, fmt.Errorf("source connector does not accept input schema")
	}

	collectionName, ok := c.Config["collection"].(string)
	if !ok || collectionName == "" {
		return nil, fmt.Errorf("collection name is required")
	}

	nodeID := c.ID()
	schema := c.getCollectionSchemaWithSource(collectionName, nodeID)
	return &schema, nil
}

// ValidateInputSchema validates input schema
func (c *PocketBaseConnector) ValidateInputSchema(schema *types.DataSchema) error {
	if schema != nil {
		return fmt.Errorf("source connector does not accept input schema")
	}
	return nil
}

func (c *PocketBaseConnector) getCollectionSchemaWithSource(collectionName string, nodeID string) types.DataSchema {
	schema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: []string{nodeID},
	}

	dao := store.GetDao()
	if dao == nil {
		return schema
	}

	collection, err := dao.FindCollectionByNameOrId(collectionName)
	if err != nil {
		logger.Info.Printf("Could not find collection %s for schema introspection: %v", collectionName, err)
		return schema
	}

	for _, field := range collection.Fields {
		fieldJSON, _ := json.Marshal(field)
		var fieldMap map[string]interface{}
		if err := json.Unmarshal(fieldJSON, &fieldMap); err == nil {
			fieldName, _ := fieldMap["name"].(string)
			fieldType, _ := fieldMap["type"].(string)
			required, _ := fieldMap["required"].(bool)

			normalizedType := normalizePocketBaseFieldType(fieldType)

			fieldDef := types.FieldDefinition{
				Name:       fieldName,
				Type:       normalizedType,
				SourceNode: nodeID,
				Nullable:   !required,
			}

			if options, ok := fieldMap["options"].(map[string]interface{}); ok {
				if desc, ok := options["description"].(string); ok {
					fieldDef.Description = desc
				}
			}

			schema.Fields = append(schema.Fields, fieldDef)
		}
	}

	return schema
}

// normalizePocketBaseFieldType converts PocketBase field types to our standard types
func normalizePocketBaseFieldType(pbType string) string {
	switch pbType {
	case "text", "email", "url", "editor":
		return "string"
	case "number":
		return "number"
	case "bool":
		return "boolean"
	case "date", "select":
		return "string" // Dates are stored as strings in JSON
	case "json", "relation", "file":
		return "json"
	default:
		return "string" // Default fallback
	}
}
