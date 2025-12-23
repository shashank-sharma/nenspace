package connectors

import (
	"context"
	"fmt"
	"strings"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// ScriptConnector is a processor connector that executes custom code/scripts
// Currently supports JavaScript-like expressions and basic transformations
type ScriptConnector struct {
	types.BaseConnector
}

// NewScriptConnector creates a new script processor connector
func NewScriptConnector() types.Connector {
	schema := map[string]interface{}{
		"script": map[string]interface{}{
			"type":        "string",
			"title":       "Script Code",
			"description": "JavaScript-like code to execute. Use 'record' to access the current record, 'records' for all records array. Return the transformed record.",
			"required":    true,
		},
		"language": map[string]interface{}{
			"type":        "string",
			"title":       "Script Language",
			"description": "Language of the script (currently only 'javascript' supported)",
			"enum":        []string{"javascript"},
			"default":     "javascript",
		},
		"mode": map[string]interface{}{
			"type":        "string",
			"title":       "Execution Mode",
			"description": "How to execute the script: 'per_record' processes each record, 'batch' processes all records at once",
			"enum":        []string{"per_record", "batch"},
			"default":     "per_record",
		},
	}

	connector := &ScriptConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "script_processor",
			ConnName:     "Script Processor",
			ConnType:     types.ProcessorConnector,
			ConfigSchema: schema,
			Config:       make(map[string]interface{}),
		},
	}
	return connector
}

// Execute runs the script on input data
func (c *ScriptConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	if input == nil || len(input) == 0 {
		return nil, fmt.Errorf("no input data provided")
	}

	// Extract envelope format
	envelope := types.FromMap(input)
	if len(envelope.Data) == 0 {
		return envelope.ToMap(), nil
	}

	// Get script from config
	script, ok := c.Config["script"].(string)
	if !ok || script == "" {
		return nil, fmt.Errorf("script is required")
	}

	mode := "per_record"
	if modeVal, ok := c.Config["mode"].(string); ok {
		mode = modeVal
	}

	// Process records based on mode
	var transformedData []map[string]interface{}
	var err error

	if mode == "batch" {
		transformedData, err = c.executeBatchScript(envelope.Data, script)
	} else {
		transformedData, err = c.executePerRecordScript(envelope.Data, script)
	}

	if err != nil {
		return nil, fmt.Errorf("script execution failed: %w", err)
	}

	// Infer output schema from transformed data
	outputSchema := c.inferSchemaFromData(transformedData)
	
	// Preserve source nodes from input
	outputSchema.SourceNodes = envelope.Metadata.Schema.SourceNodes

	// Build output envelope
	outputEnvelope := &types.DataEnvelope{
		Data: transformedData,
		Metadata: types.Metadata{
			NodeType:        c.ConnID,
			RecordCount:     len(transformedData),
			ExecutionTimeMs: 0, // Will be set by engine
			Schema:          outputSchema,
			Sources:         envelope.Metadata.Sources,
			Custom: map[string]interface{}{
				"mode":   mode,
				"script": script[:minInt(100, len(script))], // Store first 100 chars
			},
		},
	}

	return outputEnvelope.ToMap(), nil
}

// executePerRecordScript executes script for each record individually
func (c *ScriptConnector) executePerRecordScript(records []map[string]interface{}, script string) ([]map[string]interface{}, error) {
	transformedData := make([]map[string]interface{}, 0, len(records))

	for _, record := range records {
		transformedRecord, err := c.executeScriptOnRecord(record, script)
		if err != nil {
			return nil, fmt.Errorf("failed to process record: %w", err)
		}
		transformedData = append(transformedData, transformedRecord)
	}

	return transformedData, nil
}

// executeBatchScript executes script on all records at once
func (c *ScriptConnector) executeBatchScript(records []map[string]interface{}, script string) ([]map[string]interface{}, error) {
	// For batch mode, we execute the script with access to all records
	// This is a simplified implementation - in production, use a proper JS engine
	result, err := c.executeScriptWithRecords(records, script)
	if err != nil {
		return nil, err
	}

	// Result should be an array of records
	if resultArray, ok := result.([]map[string]interface{}); ok {
		return resultArray, nil
	}

	// If not an array, wrap in array
	if resultMap, ok := result.(map[string]interface{}); ok {
		return []map[string]interface{}{resultMap}, nil
	}

	return nil, fmt.Errorf("script must return an array of records or a single record")
}

// executeScriptOnRecord executes script on a single record
// This is a simplified implementation - in production, use a proper JS engine like goja
func (c *ScriptConnector) executeScriptOnRecord(record map[string]interface{}, script string) (map[string]interface{}, error) {
	// For now, we'll do basic expression evaluation
	// In production, integrate with goja (https://github.com/dop251/goja) for full JS support
	
	// Simple field access and basic operations
	result := make(map[string]interface{})
	
	// Copy original record
	for k, v := range record {
		result[k] = v
	}

	// Basic script execution - replace field references
	// This is a placeholder - full implementation would use goja
	processedScript := script
	
	// Replace ${fieldName} with actual values
	for field, value := range record {
		placeholder := fmt.Sprintf("${%s}", field)
		if strings.Contains(processedScript, placeholder) {
			processedScript = strings.ReplaceAll(processedScript, placeholder, fmt.Sprintf("%v", value))
		}
	}

	// For now, if script looks like an assignment, try to parse it
	// Example: "result.newField = record.oldField + 10"
	if strings.Contains(processedScript, "=") {
		// Simple assignment parsing
		parts := strings.Split(processedScript, "=")
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			
			// Remove "result." prefix if present
			fieldName := strings.TrimPrefix(left, "result.")
			fieldName = strings.TrimPrefix(fieldName, "record.")
			
			// Try to evaluate right side as expression
			// This is very basic - full implementation needs proper expression parser
			result[fieldName] = right
		}
	}

	return result, nil
}

// executeScriptWithRecords executes script with access to all records
func (c *ScriptConnector) executeScriptWithRecords(records []map[string]interface{}, script string) (interface{}, error) {
	// Placeholder for batch execution
	// In production, use goja to execute full JavaScript
	return records, nil
}

// inferSchemaFromData infers schema from transformed data
func (c *ScriptConnector) inferSchemaFromData(data []map[string]interface{}) types.DataSchema {
	schema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: make([]string, 0),
	}

	if len(data) == 0 {
		return schema
	}

	// Collect all field names and infer types from first record
	fieldMap := make(map[string]types.FieldDefinition)
	for _, record := range data {
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

// GetOutputSchema returns the output schema
// For script nodes, we can't determine schema without executing, so we return input schema
// The actual schema will be inferred from execution results
func (c *ScriptConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if inputSchema == nil {
		return &types.DataSchema{
			Fields:      make([]types.FieldDefinition, 0),
			SourceNodes: make([]string, 0),
		}, nil
	}

	// For script nodes, we can't statically determine output schema
	// Return input schema as a best guess - actual schema will be inferred from execution
	// In a production system, you might want to execute the script with sample data
	outputSchema := *inputSchema
	return &outputSchema, nil
}

// ValidateInputSchema validates the input schema
func (c *ScriptConnector) ValidateInputSchema(schema *types.DataSchema) error {
	// Script processor accepts any input schema
	return nil
}

// minInt returns the minimum of two integers
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

