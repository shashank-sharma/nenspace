package connectors

import (
	"context"
	"fmt"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// PBToCsvConverter is a utility connector that converts PocketBase data to CSV
type PBToCsvConverter struct {
	types.BaseConnector
}

// NewPBToCsvConverter creates a new PocketBase to CSV converter connector
func NewPBToCsvConverter() types.Connector {
	schema := map[string]interface{}{
		"inputFormat": map[string]interface{}{
			"type":        "string",
			"title":       "Input Format",
			"description": "Format of the input data (json)",
			"default":     "json",
			"enum":        []string{"json"},
		},
	}

	connector := &PBToCsvConverter{
		BaseConnector: types.BaseConnector{
			ConnID:       "pb_to_csv_converter",
			ConnName:     "PocketBase to CSV Converter",
			ConnType:     types.ProcessorConnector,
			ConfigSchema: schema,
			Config:       make(map[string]interface{}),
		},
	}
	return connector
}

// Execute converts the input data to a format suitable for CSV destination
// Accepts envelope format and preserves schema metadata
func (c *PBToCsvConverter) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	if input == nil || len(input) == 0 {
		return nil, fmt.Errorf("no data provided for CSV conversion")
	}

	// Try to extract envelope format
	envelope := types.FromMap(input)
	var records []map[string]interface{}

	// Extract records from envelope
	if len(envelope.Data) > 0 {
		records = envelope.Data
	} else {
		// Fallback: try legacy formats
		if data, exists := input["data"]; exists {
			if recordsArray, ok := data.([]map[string]interface{}); ok {
				records = recordsArray
			} else if recordsArray, ok := data.([]interface{}); ok {
				// Convert []interface{} to []map[string]interface{}
				for _, item := range recordsArray {
					if record, ok := item.(map[string]interface{}); ok {
						records = append(records, record)
					}
				}
			}
		}

		if records == nil {
			if array, ok := input["records"].([]map[string]interface{}); ok {
				records = array
			} else if array, ok := input["records"].([]interface{}); ok {
				// Convert []interface{} to []map[string]interface{}
				for _, item := range array {
					if record, ok := item.(map[string]interface{}); ok {
						records = append(records, record)
					}
				}
			}
		}
	}

	// If still no records, return error
	if records == nil || len(records) == 0 {
		return nil, fmt.Errorf("no valid records found in input data")
	}

	// Preserve or infer schema
	outputSchema := envelope.Metadata.Schema
	if len(outputSchema.Fields) == 0 {
		// Infer schema from data if not provided
		outputSchema = inferSchemaFromRecords(records)
	}

	// Build output envelope
	outputEnvelope := &types.DataEnvelope{
		Data: records,
		Metadata: types.Metadata{
			NodeType:        c.ConnID,
			RecordCount:     len(records),
			ExecutionTimeMs: 0, // Will be set by engine
			Schema:          outputSchema,
			Sources:         envelope.Metadata.Sources,
			Custom: map[string]interface{}{
				"status":       "converted",
				"input_format": "json",
			},
		},
	}

	return outputEnvelope.ToMap(), nil
}

// GetOutputSchema returns the schema this converter produces
// For CSV conversion, the output schema is the same as input schema (pass-through)
func (c *PBToCsvConverter) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if inputSchema == nil {
		// If no input schema, return empty (will be inferred from data)
		return &types.DataSchema{
			Fields:      make([]types.FieldDefinition, 0),
			SourceNodes: make([]string, 0),
		}, nil
	}

	// CSV converter preserves the input schema
	// All fields from input will be available in output
	return inputSchema, nil
}

// ValidateInputSchema validates if input schema is compatible
// CSV converter accepts any schema (it's a pass-through transformer)
func (c *PBToCsvConverter) ValidateInputSchema(schema *types.DataSchema) error {
	// CSV converter accepts any input schema
	// No validation needed - it just passes data through
	return nil
}

// inferSchemaFromRecords infers a schema from record data
func inferSchemaFromRecords(records []map[string]interface{}) types.DataSchema {
	schema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}

	if len(records) == 0 {
		return schema
	}

	// Collect all field names and infer types from first record
	fieldMap := make(map[string]types.FieldDefinition)
	for _, record := range records {
		for fieldName, value := range record {
			if _, exists := fieldMap[fieldName]; !exists {
				fieldType := inferFieldType(value)
				fieldMap[fieldName] = types.FieldDefinition{
					Name:     fieldName,
					Type:     fieldType,
					Nullable: value == nil,
				}
			} else {
				// Update nullable if we find a nil value
				if value == nil {
					field := fieldMap[fieldName]
					field.Nullable = true
					fieldMap[fieldName] = field
				}
			}
		}
	}

	// Convert map to slice
	for _, field := range fieldMap {
		schema.Fields = append(schema.Fields, field)
	}

	return schema
}

// inferFieldType attempts to infer the type of a value
func inferFieldType(value interface{}) string {
	if value == nil {
		return "string" // Default to string for null values
	}

	switch value.(type) {
	case bool:
		return "boolean"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "number"
	case float32, float64:
		return "number"
	case string:
		return "string"
	case []interface{}, map[string]interface{}:
		return "json"
	default:
		return "string" // Default fallback
	}
}
