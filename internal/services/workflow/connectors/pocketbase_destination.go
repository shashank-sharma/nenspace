package connectors

import (
	"context"
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

type PocketBaseDestinationConnector struct {
	types.BaseConnector
}

func NewPocketBaseDestinationConnector() types.Connector {
	configSchema := map[string]interface{}{
		"collection": map[string]interface{}{
			"type":        "string",
			"title":       "Collection",
			"description": "Name of the PocketBase collection to write to",
			"required":    true,
		},
		"mode": map[string]interface{}{
			"type":        "string",
			"title":       "Write Mode",
			"description": "How to write records: create (insert only), update (update existing), upsert (insert or update)",
			"enum":        []string{"create", "update", "upsert"},
			"default":     "create",
			"required":    false,
		},
		"id_field": map[string]interface{}{
			"type":        "string",
			"title":       "ID Field",
			"description": "Field name to use as record ID for update/upsert operations",
			"default":     "id",
			"required":    false,
		},
		"batch_size": map[string]interface{}{
			"type":        "number",
			"title":       "Batch Size",
			"description": "Number of records to write per batch (default: 100, max: 500)",
			"default":     100,
			"minimum":     1,
			"maximum":     500,
		},
		"user_field": map[string]interface{}{
			"type":        "string",
			"title":       "User Field",
			"description": "Field name to populate with the current user ID",
			"default":     "user",
			"required":    false,
		},
	}

	connector := &PocketBaseDestinationConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "pocketbase_destination",
			ConnName:     "PocketBase Destination",
			ConnType:     types.DestinationConnector,
			ConfigSchema: configSchema,
			Config:       make(map[string]interface{}),
		},
	}
	return connector
}

func (c *PocketBaseDestinationConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	collectionName, ok := c.Config["collection"].(string)
	if !ok || collectionName == "" {
		return nil, fmt.Errorf("collection name is required")
	}

	userID, ok := util.GetUserIDFromContext(ctx)
	if !ok || userID == "" {
		return nil, fmt.Errorf("user ID not found in context")
	}

	mode := "create"
	if m, ok := c.Config["mode"].(string); ok && m != "" {
		mode = m
	}

	idField := "id"
	if f, ok := c.Config["id_field"].(string); ok && f != "" {
		idField = f
	}

	batchSize := 100
	if bs, ok := c.Config["batch_size"].(float64); ok {
		batchSize = int(bs)
	}
	if batchSize > 500 {
		batchSize = 500
	}

	userField := "user"
	if uf, ok := c.Config["user_field"].(string); ok && uf != "" {
		userField = uf
	}

	envelope := types.FromMap(input)
	inputData := envelope.Data
	if len(inputData) == 0 {
		logger.Info.Printf("No data to write to collection %s", collectionName)
		return c.createEmptyResult(), nil
	}

	dao := store.GetDao()
	if dao == nil {
		return nil, fmt.Errorf("failed to get PocketBase instance")
	}

	_, err := dao.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return nil, fmt.Errorf("failed to find collection %s: %w", collectionName, err)
	}

	totalWritten := 0
	totalErrors := 0
	errors := make([]string, 0)

	for i := 0; i < len(inputData); i += batchSize {
		end := i + batchSize
		if end > len(inputData) {
			end = len(inputData)
		}
		batch := inputData[i:end]

		for _, record := range batch {
			recordMap := make(map[string]interface{})
			for k, v := range record {
				recordMap[k] = v
			}

			if userField != "" && recordMap[userField] == nil {
				recordMap[userField] = userID
			}

			var writeErr error
			switch mode {
			case "create":
				writeErr = c.createRecord(dao, collectionName, recordMap)
			case "update":
				writeErr = c.updateRecord(dao, collectionName, recordMap, idField)
			case "upsert":
				writeErr = c.upsertRecord(dao, collectionName, recordMap, idField, userID)
			default:
				writeErr = fmt.Errorf("unknown write mode: %s", mode)
			}

			if writeErr != nil {
				totalErrors++
				errors = append(errors, writeErr.Error())
				if len(errors) > 10 {
					errors = errors[:10]
				}
			} else {
				totalWritten++
			}
		}

		logger.Info.Printf("Wrote batch to collection %s: %d records (total: %d, errors: %d)",
			collectionName, len(batch), totalWritten, totalErrors)
	}

	if totalErrors > 0 && totalWritten == 0 {
		return nil, fmt.Errorf("failed to write any records: %v", errors)
	}

	nodeID := c.ID()
	resultEnvelope := &types.DataEnvelope{
		Data: make([]map[string]interface{}, 0),
		Metadata: types.Metadata{
			NodeID:      nodeID,
			NodeType:    c.ConnID,
			RecordCount: 0,
			Schema:      envelope.Metadata.Schema,
			Sources:     envelope.Metadata.Sources,
			Custom: map[string]interface{}{
				"collection":      collectionName,
				"mode":            mode,
				"records_written": totalWritten,
				"errors":          totalErrors,
				"error_samples":   errors,
			},
		},
	}

	return resultEnvelope.ToMap(), nil
}

func (c *PocketBaseDestinationConnector) createRecord(dao *pocketbase.PocketBase, collectionName string, record map[string]interface{}) error {
	collection, err := dao.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return fmt.Errorf("collection not found: %w", err)
	}

	recordObj := core.NewRecord(collection)
	for key, value := range record {
		recordObj.Set(key, value)
	}

	if err := dao.Save(recordObj); err != nil {
		return fmt.Errorf("failed to create record: %w", err)
	}
	return nil
}

func (c *PocketBaseDestinationConnector) updateRecord(dao *pocketbase.PocketBase, collectionName string, record map[string]interface{}, idField string) error {
	recordID, ok := record[idField].(string)
	if !ok || recordID == "" {
		return fmt.Errorf("missing or invalid %s field for update", idField)
	}

	existingRecord, err := dao.FindRecordById(collectionName, recordID)
	if err != nil {
		return fmt.Errorf("record not found for update: %w", err)
	}

	for key, value := range record {
		existingRecord.Set(key, value)
	}

	if err := dao.Save(existingRecord); err != nil {
		return fmt.Errorf("failed to update record: %w", err)
	}
	return nil
}

func (c *PocketBaseDestinationConnector) upsertRecord(dao *pocketbase.PocketBase, collectionName string, record map[string]interface{}, idField string, userID string) error {
	recordID, hasID := record[idField].(string)

	if hasID && recordID != "" {
		existingRecord, err := dao.FindRecordById(collectionName, recordID)
		if err == nil {
			for key, value := range record {
				existingRecord.Set(key, value)
			}
			if err := dao.Save(existingRecord); err != nil {
				return fmt.Errorf("failed to update record in upsert: %w", err)
			}
			return nil
		}
	}

	return c.createRecord(dao, collectionName, record)
}

func (c *PocketBaseDestinationConnector) createEmptyResult() map[string]interface{} {
	nodeID := c.ID()
	envelope := &types.DataEnvelope{
		Data: make([]map[string]interface{}, 0),
		Metadata: types.Metadata{
			NodeID:      nodeID,
			NodeType:    c.ConnID,
			RecordCount: 0,
			Schema: types.DataSchema{
				Fields:      make([]types.FieldDefinition, 0),
				SourceNodes: make([]string, 0),
			},
			Sources: []string{nodeID},
		},
	}
	return envelope.ToMap()
}

func (c *PocketBaseDestinationConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if inputSchema != nil {
		return inputSchema, nil
	}
	return &types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}, nil
}

func (c *PocketBaseDestinationConnector) ValidateInputSchema(schema *types.DataSchema) error {
	if schema == nil || len(schema.Fields) == 0 {
		return fmt.Errorf("destination connector requires input schema with at least one field")
	}
	return nil
}
