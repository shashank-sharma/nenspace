package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dop251/goja"
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

	outputSchema.SourceNodes = envelope.Metadata.Schema.SourceNodes

	nodeID := c.ID()
	outputEnvelope := &types.DataEnvelope{
		Data: transformedData,
		Metadata: types.Metadata{
			NodeID:          nodeID,
			NodeType:        c.ConnID,
			RecordCount:     len(transformedData),
			ExecutionTimeMs: 0,
			Schema:          outputSchema,
			Sources:         envelope.Metadata.Sources,
			Custom: map[string]interface{}{
				"mode":   mode,
				"script": script[:minInt(100, len(script))],
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

// executeScriptOnRecord executes script on a single record using goja JavaScript engine
func (c *ScriptConnector) executeScriptOnRecord(record map[string]interface{}, script string) (map[string]interface{}, error) {
	vm := goja.New()

	consoleObj := vm.NewObject()
	consoleObj.Set("log", func(args ...interface{}) {
		_ = args
	})
	vm.Set("console", consoleObj)

	if err := vm.Set("record", record); err != nil {
		return nil, fmt.Errorf("failed to set record variable: %w", err)
	}

	wrappedScript := fmt.Sprintf(`
		(function() {
			%s
			// If script doesn't return anything, return the record
			if (typeof result !== 'undefined') {
				return result;
			}
			return record;
		})()
	`, script)

	value, err := vm.RunString(wrappedScript)
	if err != nil {
		// Try to extract line number from error if available
		errStr := err.Error()
		if strings.Contains(errStr, "SyntaxError") || strings.Contains(errStr, "ReferenceError") {
			return nil, fmt.Errorf("script execution error: %w", err)
		}
		return nil, fmt.Errorf("script execution failed: %w", err)
	}

	result, err := c.gojaValueToMap(value)
	if err != nil {
		return nil, fmt.Errorf("failed to convert script result: %w", err)
	}

	return result, nil
}

// executeScriptWithRecords executes script with access to all records
func (c *ScriptConnector) executeScriptWithRecords(records []map[string]interface{}, script string) (interface{}, error) {
	vm := goja.New()

	consoleObj := vm.NewObject()
	consoleObj.Set("log", func(args ...interface{}) {
		_ = args
	})
	vm.Set("console", consoleObj)

	if err := vm.Set("records", records); err != nil {
		return nil, fmt.Errorf("failed to set records variable: %w", err)
	}

	wrappedScript := fmt.Sprintf(`
		(function() {
			%s
			// If script doesn't return anything, return the records
			if (typeof result !== 'undefined') {
				return result;
			}
			return records;
		})()
	`, script)

	value, err := vm.RunString(wrappedScript)
	if err != nil {
		return nil, fmt.Errorf("script execution failed: %w", err)
	}

	result, err := c.gojaValueToInterface(value)
	if err != nil {
		return nil, fmt.Errorf("failed to convert script result: %w", err)
	}

	return result, nil
}

// gojaValueToMap converts a goja Value to map[string]interface{}
func (c *ScriptConnector) gojaValueToMap(value goja.Value) (map[string]interface{}, error) {
	if value == nil {
		return make(map[string]interface{}), nil
	}

	// Check if it's an object
	if obj := value.ToObject(nil); obj != nil {
		result := make(map[string]interface{})
		for _, key := range obj.Keys() {
			val := obj.Get(key)
			if val != nil {
				converted, err := c.gojaValueToInterface(val)
				if err != nil {
					return nil, err
				}
				result[key] = converted
			}
		}
		return result, nil
	}

	jsonStr := value.String()
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &result); err == nil {
		return result, nil
	}

	convertedValue, err := c.gojaValueToInterface(value)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"value": convertedValue,
	}, nil
}

func (c *ScriptConnector) gojaValueToInterface(value goja.Value) (interface{}, error) {
	if value == nil {
		return nil, nil
	}

	if obj := value.ToObject(nil); obj != nil {
		length := obj.Get("length")
		if length != nil && !goja.IsUndefined(length) {
			arrLen := int(length.ToInteger())
			result := make([]interface{}, arrLen)
			for i := 0; i < arrLen; i++ {
				item := obj.Get(fmt.Sprintf("%d", i))
				if item != nil && !goja.IsUndefined(item) {
					converted, err := c.gojaValueToInterface(item)
					if err != nil {
						return nil, err
					}
					result[i] = converted
				}
			}
			return result, nil
		}
		return c.gojaValueToMap(value)
	}

	exported := value.Export()
	if exported != nil {
		return exported, nil
	}

	return value.String(), nil
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
				fieldType := InferFieldType(value)
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
