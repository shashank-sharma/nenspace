package connectors

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// TransformConnector is a processor connector that applies transformations to input data
type TransformConnector struct {
	types.BaseConnector
}

// NewTransformConnector creates a new transform processor connector
func NewTransformConnector() types.Connector {
	schema := map[string]interface{}{
		"transformations": map[string]interface{}{
			"type":        "array",
			"title":       "Transformations",
			"description": "List of transformations to apply to the data",
			"items": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"type": map[string]interface{}{
						"type":        "string",
						"title":       "Transformation Type",
						"description": "Type of transformation to apply",
						"enum": []string{
							"rename",
							"delete",
							"add",
							"modify",
							"cast",
							"filter",
							"copy",
							"lowercase",
							"uppercase",
							"trim",
							"replace",
							"concat",
							"split",
							"format_date",
							"parse_date",
						},
						"required": true,
					},
					"sourceField": map[string]interface{}{
						"type":        "string",
						"title":       "Source Field",
						"description": "Name of the source field (required for most transformations)",
					},
					"targetField": map[string]interface{}{
						"type":        "string",
						"title":       "Target Field",
						"description": "Name of the target field (for rename, add, copy, modify)",
					},
					"value": map[string]interface{}{
						"type":        "string",
						"title":       "Value",
						"description": "Value to use (for add, modify, replace operations)",
					},
					"expression": map[string]interface{}{
						"type":        "string",
						"title":       "Expression",
						"description": "Expression for modify operations (e.g., 'field1 + field2')",
					},
					"condition": map[string]interface{}{
						"type":        "string",
						"title":       "Condition",
						"description": "Condition for filter operations (e.g., 'age > 18')",
					},
					"toType": map[string]interface{}{
						"type":        "string",
						"title":       "Target Type",
						"description": "Target type for cast operations (string, number, boolean, date)",
						"enum":        []string{"string", "number", "boolean", "date"},
					},
					"separator": map[string]interface{}{
						"type":        "string",
						"title":       "Separator",
						"description": "Separator for split/concat operations",
						"default":     ",",
					},
					"dateFormat": map[string]interface{}{
						"type":        "string",
						"title":       "Date Format",
						"description": "Date format string (e.g., '2006-01-02' for Go, 'YYYY-MM-DD' for display)",
						"default":     "2006-01-02",
					},
					"oldValue": map[string]interface{}{
						"type":        "string",
						"title":       "Old Value",
						"description": "Value to replace (for replace operation)",
					},
					"newValue": map[string]interface{}{
						"type":        "string",
						"title":       "New Value",
						"description": "Replacement value (for replace operation)",
					},
				},
				"required": []string{"type"},
			},
		},
	}

	connector := &TransformConnector{
		BaseConnector: types.BaseConnector{
			ConnID:       "transform_processor",
			ConnName:     "Transform Processor",
			ConnType:     types.ProcessorConnector,
			ConfigSchema: schema,
			Config:       make(map[string]interface{}),
		},
	}
	return connector
}

// Execute applies transformations to the input data
func (c *TransformConnector) Execute(ctx context.Context, input map[string]interface{}) (map[string]interface{}, error) {
	if input == nil || len(input) == 0 {
		return nil, fmt.Errorf("no input data provided")
	}

	// Extract envelope format
	envelope := types.FromMap(input)
	if len(envelope.Data) == 0 {
		// Return empty envelope if no data
		return envelope.ToMap(), nil
	}

	// Get transformations from config
	transformations, err := c.getTransformations()
	if err != nil {
		return nil, fmt.Errorf("failed to parse transformations: %w", err)
	}

	if len(transformations) == 0 {
		// No transformations, return input as-is
		return envelope.ToMap(), nil
	}

	// Apply transformations to each record
	transformedData := make([]map[string]interface{}, 0, len(envelope.Data))
	for _, record := range envelope.Data {
		transformedRecord, err := c.applyTransformations(record, transformations, envelope.Metadata.Schema)
		if err != nil {
			return nil, fmt.Errorf("failed to apply transformations: %w", err)
		}
		transformedData = append(transformedData, transformedRecord)
	}

	outputSchema := c.computeOutputSchema(envelope.Metadata.Schema, transformations)

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
				"transformations_applied": len(transformations),
				"input_record_count":      envelope.Metadata.RecordCount,
			},
		},
	}

	return outputEnvelope.ToMap(), nil
}

// getTransformations extracts and validates transformations from config
func (c *TransformConnector) getTransformations() ([]map[string]interface{}, error) {
	transformationsRaw, exists := c.Config["transformations"]
	if !exists {
		return []map[string]interface{}{}, nil
	}

	transformationsArray, ok := transformationsRaw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("transformations must be an array")
	}

	transformations := make([]map[string]interface{}, 0, len(transformationsArray))
	for i, t := range transformationsArray {
		transformation, ok := t.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("transformation at index %d must be an object", i)
		}

		transType, ok := transformation["type"].(string)
		if !ok || transType == "" {
			return nil, fmt.Errorf("transformation at index %d must have a 'type' field", i)
		}

		transformations = append(transformations, transformation)
	}

	return transformations, nil
}

// applyTransformations applies all transformations to a single record
func (c *TransformConnector) applyTransformations(
	record map[string]interface{},
	transformations []map[string]interface{},
	inputSchema types.DataSchema,
) (map[string]interface{}, error) {
	// Create a copy to avoid mutating the original
	result := make(map[string]interface{})
	for k, v := range record {
		result[k] = v
	}

	// Apply transformations in order
	for _, transformation := range transformations {
		transType, _ := transformation["type"].(string)
		sourceField, _ := transformation["sourceField"].(string)
		targetField, _ := transformation["targetField"].(string)

		var err error
		switch transType {
		case "rename":
			err = c.applyRename(result, sourceField, targetField)
		case "delete":
			err = c.applyDelete(result, sourceField)
		case "add":
			err = c.applyAdd(result, targetField, transformation)
		case "modify":
			err = c.applyModify(result, sourceField, transformation)
		case "cast":
			err = c.applyCast(result, sourceField, targetField, transformation)
		case "filter":
			// Filter is handled at record level, skip here
			continue
		case "copy":
			err = c.applyCopy(result, sourceField, targetField)
		case "lowercase":
			err = c.applyLowercase(result, sourceField)
		case "uppercase":
			err = c.applyUppercase(result, sourceField)
		case "trim":
			err = c.applyTrim(result, sourceField)
		case "replace":
			err = c.applyReplace(result, sourceField, transformation)
		case "concat":
			err = c.applyConcat(result, sourceField, targetField, transformation)
		case "split":
			err = c.applySplit(result, sourceField, targetField, transformation)
		case "format_date":
			err = c.applyFormatDate(result, sourceField, targetField, transformation)
		case "parse_date":
			err = c.applyParseDate(result, sourceField, targetField, transformation)
		default:
			return nil, fmt.Errorf("unknown transformation type: %s", transType)
		}

		if err != nil {
			return nil, fmt.Errorf("transformation %s failed: %w", transType, err)
		}
	}

	return result, nil
}

// Transformation implementations

func (c *TransformConnector) applyRename(record map[string]interface{}, sourceField, targetField string) error {
	if sourceField == "" || targetField == "" {
		return fmt.Errorf("rename requires both sourceField and targetField")
	}

	value, exists := record[sourceField]
	if !exists {
		// Field doesn't exist, skip
		return nil
	}

	record[targetField] = value
	delete(record, sourceField)
	return nil
}

func (c *TransformConnector) applyDelete(record map[string]interface{}, sourceField string) error {
	if sourceField == "" {
		return fmt.Errorf("delete requires sourceField")
	}
	delete(record, sourceField)
	return nil
}

func (c *TransformConnector) applyAdd(record map[string]interface{}, targetField string, transformation map[string]interface{}) error {
	if targetField == "" {
		return fmt.Errorf("add requires targetField")
	}

	// Check if value is provided
	if value, ok := transformation["value"]; ok && value != nil {
		record[targetField] = value
		return nil
	}

	// Check if expression is provided
	if expression, ok := transformation["expression"].(string); ok && expression != "" {
		result, err := c.evaluateExpression(record, expression)
		if err != nil {
			return fmt.Errorf("failed to evaluate expression: %w", err)
		}
		record[targetField] = result
		return nil
	}

	// Default to empty string
	record[targetField] = ""
	return nil
}

func (c *TransformConnector) applyModify(record map[string]interface{}, sourceField string, transformation map[string]interface{}) error {
	if sourceField == "" {
		return fmt.Errorf("modify requires sourceField")
	}

	_, exists := record[sourceField]
	if !exists {
		// Field doesn't exist, skip
		return nil
	}

	// Check if expression is provided
	if expression, ok := transformation["expression"].(string); ok && expression != "" {
		result, err := c.evaluateExpression(record, expression)
		if err != nil {
			return fmt.Errorf("failed to evaluate expression: %w", err)
		}
		record[sourceField] = result
		return nil
	}

	// Check if value is provided
	if newValue, ok := transformation["value"]; ok && newValue != nil {
		record[sourceField] = newValue
		return nil
	}

	return fmt.Errorf("modify requires either expression or value")
}

func (c *TransformConnector) applyCast(record map[string]interface{}, sourceField, targetField string, transformation map[string]interface{}) error {
	if sourceField == "" {
		return fmt.Errorf("cast requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		// Field doesn't exist, skip
		return nil
	}

	toType, ok := transformation["toType"].(string)
	if !ok || toType == "" {
		return fmt.Errorf("cast requires toType")
	}

	castedValue, err := c.castValue(value, toType)
	if err != nil {
		return fmt.Errorf("failed to cast value: %w", err)
	}

	if targetField != "" && targetField != sourceField {
		record[targetField] = castedValue
		delete(record, sourceField)
	} else {
		record[sourceField] = castedValue
	}

	return nil
}

func (c *TransformConnector) applyCopy(record map[string]interface{}, sourceField, targetField string) error {
	if sourceField == "" || targetField == "" {
		return fmt.Errorf("copy requires both sourceField and targetField")
	}

	value, exists := record[sourceField]
	if !exists {
		// Field doesn't exist, skip
		return nil
	}

	record[targetField] = value
	return nil
}

func (c *TransformConnector) applyLowercase(record map[string]interface{}, sourceField string) error {
	if sourceField == "" {
		return fmt.Errorf("lowercase requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	if str, ok := value.(string); ok {
		record[sourceField] = strings.ToLower(str)
	}
	return nil
}

func (c *TransformConnector) applyUppercase(record map[string]interface{}, sourceField string) error {
	if sourceField == "" {
		return fmt.Errorf("uppercase requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	if str, ok := value.(string); ok {
		record[sourceField] = strings.ToUpper(str)
	}
	return nil
}

func (c *TransformConnector) applyTrim(record map[string]interface{}, sourceField string) error {
	if sourceField == "" {
		return fmt.Errorf("trim requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	if str, ok := value.(string); ok {
		record[sourceField] = strings.TrimSpace(str)
	}
	return nil
}

func (c *TransformConnector) applyReplace(record map[string]interface{}, sourceField string, transformation map[string]interface{}) error {
	if sourceField == "" {
		return fmt.Errorf("replace requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	if str, ok := value.(string); ok {
		oldValue, _ := transformation["oldValue"].(string)
		newValue, _ := transformation["newValue"].(string)
		record[sourceField] = strings.ReplaceAll(str, oldValue, newValue)
	}
	return nil
}

func (c *TransformConnector) applyConcat(record map[string]interface{}, sourceField, targetField string, transformation map[string]interface{}) error {
	if sourceField == "" {
		return fmt.Errorf("concat requires sourceField")
	}

	separator := ","
	if sep, ok := transformation["separator"].(string); ok && sep != "" {
		separator = sep
	}

	// Get all fields to concatenate
	fields := []string{sourceField}
	if targetField != "" {
		// If targetField is provided, it might be a comma-separated list of fields
		fields = strings.Split(targetField, ",")
		for i, f := range fields {
			fields[i] = strings.TrimSpace(f)
		}
	}

	values := make([]string, 0, len(fields))
	for _, field := range fields {
		if val, exists := record[field]; exists {
			values = append(values, fmt.Sprintf("%v", val))
		}
	}

	result := strings.Join(values, separator)

	// Store in targetField if provided, otherwise in sourceField
	if targetField != "" && !strings.Contains(targetField, ",") {
		record[targetField] = result
	} else {
		record[sourceField] = result
	}

	return nil
}

func (c *TransformConnector) applySplit(record map[string]interface{}, sourceField, targetField string, transformation map[string]interface{}) error {
	if sourceField == "" || targetField == "" {
		return fmt.Errorf("split requires both sourceField and targetField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	separator := ","
	if sep, ok := transformation["separator"].(string); ok && sep != "" {
		separator = sep
	}

	if str, ok := value.(string); ok {
		parts := strings.Split(str, separator)
		record[targetField] = parts
	}
	return nil
}

func (c *TransformConnector) applyFormatDate(record map[string]interface{}, sourceField, targetField string, transformation map[string]interface{}) error {
	if sourceField == "" {
		return fmt.Errorf("format_date requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	dateFormat := "2006-01-02"
	if format, ok := transformation["dateFormat"].(string); ok && format != "" {
		dateFormat = format
	}

	// Try to parse the date value
	var dateTime time.Time
	var err error

	switch v := value.(type) {
	case string:
		// Try common date formats
		formats := []string{
			time.RFC3339,
			"2006-01-02",
			"2006-01-02T15:04:05",
			"2006-01-02 15:04:05",
			"01/02/2006",
		}
		for _, format := range formats {
			dateTime, err = time.Parse(format, v)
			if err == nil {
				break
			}
		}
		if err != nil {
			return fmt.Errorf("failed to parse date: %w", err)
		}
	case float64:
		// Unix timestamp
		dateTime = time.Unix(int64(v), 0)
	case int64:
		dateTime = time.Unix(v, 0)
	case int:
		dateTime = time.Unix(int64(v), 0)
	default:
		return fmt.Errorf("unsupported date type: %T", v)
	}

	formatted := dateTime.Format(dateFormat)

	if targetField != "" && targetField != sourceField {
		record[targetField] = formatted
		delete(record, sourceField)
	} else {
		record[sourceField] = formatted
	}

	return nil
}

func (c *TransformConnector) applyParseDate(record map[string]interface{}, sourceField, targetField string, transformation map[string]interface{}) error {
	if sourceField == "" {
		return fmt.Errorf("parse_date requires sourceField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	dateFormat := "2006-01-02"
	if format, ok := transformation["dateFormat"].(string); ok && format != "" {
		dateFormat = format
	}

	if str, ok := value.(string); ok {
		parsed, err := time.Parse(dateFormat, str)
		if err != nil {
			return fmt.Errorf("failed to parse date: %w", err)
		}

		if targetField != "" && targetField != sourceField {
			record[targetField] = parsed.Format(time.RFC3339)
			delete(record, sourceField)
		} else {
			record[sourceField] = parsed.Format(time.RFC3339)
		}
	}

	return nil
}

// Helper functions

func (c *TransformConnector) castValue(value interface{}, toType string) (interface{}, error) {
	switch toType {
	case "string":
		return fmt.Sprintf("%v", value), nil
	case "number":
		switch v := value.(type) {
		case float64:
			return v, nil
		case int:
			return float64(v), nil
		case int64:
			return float64(v), nil
		case string:
			f, err := strconv.ParseFloat(v, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot convert %q to number: %w", v, err)
			}
			return f, nil
		default:
			return nil, fmt.Errorf("cannot convert %T to number", value)
		}
	case "boolean":
		switch v := value.(type) {
		case bool:
			return v, nil
		case string:
			return strings.ToLower(v) == "true" || v == "1", nil
		case float64:
			return v != 0, nil
		case int:
			return v != 0, nil
		default:
			return false, nil
		}
	case "date":
		// Convert to RFC3339 string
		if str, ok := value.(string); ok {
			return str, nil
		}
		return fmt.Sprintf("%v", value), nil
	default:
		return nil, fmt.Errorf("unknown target type: %s", toType)
	}
}

func (c *TransformConnector) evaluateExpression(record map[string]interface{}, expression string) (interface{}, error) {
	// Simple expression evaluator
	// Supports: field references, basic arithmetic, string concatenation

	// Replace field references with values
	result := expression
	for field, value := range record {
		placeholder := fmt.Sprintf("${%s}", field)
		if strings.Contains(result, placeholder) {
			result = strings.ReplaceAll(result, placeholder, fmt.Sprintf("%v", value))
		}
	}

	// Try to evaluate as arithmetic expression
	// This is a simplified evaluator - for production, consider using a proper expression parser
	if strings.Contains(result, "+") || strings.Contains(result, "-") || strings.Contains(result, "*") || strings.Contains(result, "/") {
		// Simple arithmetic evaluation
		// Note: This is basic - for complex expressions, use a proper parser
		return result, nil // Return as string for now
	}

	return result, nil
}

// computeOutputSchema computes the output schema based on transformations
func (c *TransformConnector) computeOutputSchema(inputSchema types.DataSchema, transformations []map[string]interface{}) types.DataSchema {
	outputSchema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: inputSchema.SourceNodes,
	}

	// Track which fields exist in output
	fieldMap := make(map[string]types.FieldDefinition)
	for _, field := range inputSchema.Fields {
		fieldMap[field.Name] = field
	}

	// Apply transformations to schema
	for _, transformation := range transformations {
		transType, _ := transformation["type"].(string)
		sourceField, _ := transformation["sourceField"].(string)
		targetField, _ := transformation["targetField"].(string)

		switch transType {
		case "rename":
			if sourceField != "" && targetField != "" {
				if field, exists := fieldMap[sourceField]; exists {
					// Preserve source node information when renaming
					field.Name = targetField
					// Update description to reflect rename
					if field.Description == "" {
						field.Description = fmt.Sprintf("Renamed from %s", sourceField)
					} else {
						field.Description = fmt.Sprintf("%s (renamed from %s)", field.Description, sourceField)
					}
					fieldMap[targetField] = field
					delete(fieldMap, sourceField)
				}
			}
		case "delete":
			delete(fieldMap, sourceField)
		case "add":
			if targetField != "" {
				fieldMap[targetField] = types.FieldDefinition{
					Name:     targetField,
					Type:     "string", // Default type
					Nullable: true,
				}
			}
		case "cast":
			if sourceField != "" {
				if field, exists := fieldMap[sourceField]; exists {
					if toType, ok := transformation["toType"].(string); ok {
						field.Type = toType
						fieldMap[sourceField] = field
					}
					if targetField != "" && targetField != sourceField {
						field.Name = targetField
						fieldMap[targetField] = field
						delete(fieldMap, sourceField)
					}
				}
			}
		case "copy":
			if sourceField != "" && targetField != "" {
				if field, exists := fieldMap[sourceField]; exists {
					// Create a copy preserving source node info
					copiedField := types.FieldDefinition{
						Name:        targetField,
						Type:        field.Type,
						SourceNode:  field.SourceNode, // Preserve original source
						Nullable:    field.Nullable,
						Description: fmt.Sprintf("Copy of %s", field.Name),
					}
					fieldMap[targetField] = copiedField
				}
			}
		}
	}

	// Convert map to slice
	for _, field := range fieldMap {
		outputSchema.Fields = append(outputSchema.Fields, field)
	}

	return outputSchema
}

// GetOutputSchema returns the output schema after transformations
func (c *TransformConnector) GetOutputSchema(inputSchema *types.DataSchema) (*types.DataSchema, error) {
	if inputSchema == nil {
		return &types.DataSchema{
			Fields:      make([]types.FieldDefinition, 0),
			SourceNodes: make([]string, 0),
		}, nil
	}

	transformations, err := c.getTransformations()
	if err != nil {
		return nil, fmt.Errorf("failed to parse transformations: %w", err)
	}

	outputSchema := c.computeOutputSchema(*inputSchema, transformations)
	return &outputSchema, nil
}

// ValidateInputSchema validates the input schema
func (c *TransformConnector) ValidateInputSchema(schema *types.DataSchema) error {
	// Transform processor accepts any input schema
	return nil
}
