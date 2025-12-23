package workflow

import (
	"fmt"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

// SchemaValidationError represents a schema validation error
type SchemaValidationError struct {
	NodeID    string
	FieldName string
	Message   string
	Details   string
}

func (e *SchemaValidationError) Error() string {
	if e.FieldName != "" {
		return fmt.Sprintf("schema validation error at node %s, field %s: %s", e.NodeID, e.FieldName, e.Message)
	}
	return fmt.Sprintf("schema validation error at node %s: %s", e.NodeID, e.Message)
}

// ValidateSchemaCompatibility checks if an input schema is compatible with what a connector expects
func ValidateSchemaCompatibility(
	connector types.Connector,
	nodeID string,
	inputSchema *types.DataSchema,
) error {
	// If connector implements SchemaAwareConnector, use its validation
	if schemaAware, ok := connector.(types.SchemaAwareConnector); ok {
		if err := schemaAware.ValidateInputSchema(inputSchema); err != nil {
			return &SchemaValidationError{
				NodeID:  nodeID,
				Message: "input schema validation failed",
				Details: err.Error(),
			}
		}
		return nil
	}

	// For connectors that don't implement SchemaAwareConnector, do basic validation
	if inputSchema == nil {
		// Source connectors shouldn't have input
		if connector.Type() == types.SourceConnector {
			return nil
		}
		// Processor/destination connectors should have input
		if connector.Type() == types.ProcessorConnector || connector.Type() == types.DestinationConnector {
			return &SchemaValidationError{
				NodeID:  nodeID,
				Message: "processor/destination connector requires input schema",
			}
		}
	}

	return nil
}

// ValidateFieldExists checks if a field exists in the schema
func ValidateFieldExists(schema *types.DataSchema, fieldName string) error {
	if schema == nil {
		return fmt.Errorf("schema is nil")
	}

	for _, field := range schema.Fields {
		if field.Name == fieldName {
			return nil
		}
	}

	return fmt.Errorf("field '%s' not found in schema", fieldName)
}

// ValidateFieldType checks if a field has the expected type
func ValidateFieldType(schema *types.DataSchema, fieldName string, expectedType string) error {
	if err := ValidateFieldExists(schema, fieldName); err != nil {
		return err
	}

	for _, field := range schema.Fields {
		if field.Name == fieldName {
			if field.Type != expectedType {
				return fmt.Errorf("field '%s' has type '%s', expected '%s'", fieldName, field.Type, expectedType)
			}
			return nil
		}
	}

	return fmt.Errorf("field '%s' not found", fieldName)
}

// ValidateRequiredFields checks if all required fields are present in the schema
func ValidateRequiredFields(schema *types.DataSchema, requiredFields []string) error {
	if schema == nil {
		return fmt.Errorf("schema is nil")
	}

	fieldMap := make(map[string]bool)
	for _, field := range schema.Fields {
		fieldMap[field.Name] = true
	}

	var missingFields []string
	for _, requiredField := range requiredFields {
		if !fieldMap[requiredField] {
			missingFields = append(missingFields, requiredField)
		}
	}

	if len(missingFields) > 0 {
		return fmt.Errorf("missing required fields: %v", missingFields)
	}

	return nil
}

// GetFieldSourceNode returns the source node ID for a given field
func GetFieldSourceNode(schema *types.DataSchema, fieldName string) string {
	if schema == nil {
		return ""
	}

	for _, field := range schema.Fields {
		if field.Name == fieldName {
			return field.SourceNode
		}
	}

	return ""
}

// GetFieldsBySourceNode returns all fields that originated from a specific source node
func GetFieldsBySourceNode(schema *types.DataSchema, sourceNodeID string) []types.FieldDefinition {
	if schema == nil {
		return []types.FieldDefinition{}
	}

	var fields []types.FieldDefinition
	for _, field := range schema.Fields {
		if field.SourceNode == sourceNodeID {
			fields = append(fields, field)
		}
	}

	return fields
}

// ValidateTransformConfig validates transformation configuration against input schema
func ValidateTransformConfig(
	inputSchema *types.DataSchema,
	transformations []map[string]interface{},
) []error {
	var errors []error

	if inputSchema == nil {
		errors = append(errors, fmt.Errorf("input schema is required for transformations"))
		return errors
	}

	fieldMap := make(map[string]types.FieldDefinition)
	for _, field := range inputSchema.Fields {
		fieldMap[field.Name] = field
	}

	for i, transformation := range transformations {
		transType, ok := transformation["type"].(string)
		if !ok || transType == "" {
			errors = append(errors, fmt.Errorf("transformation %d: missing or invalid 'type' field", i))
			continue
		}

		sourceField, _ := transformation["sourceField"].(string)
		targetField, _ := transformation["targetField"].(string)

		// Validate source field exists for transformations that need it
		switch transType {
		case "rename", "delete", "modify", "cast", "copy", "lowercase", "uppercase", "trim", "replace", "concat", "split", "format_date", "parse_date":
			if sourceField == "" {
				errors = append(errors, fmt.Errorf("transformation %d (%s): 'sourceField' is required", i, transType))
				continue
			}

			if _, exists := fieldMap[sourceField]; !exists {
				errors = append(errors, fmt.Errorf("transformation %d (%s): source field '%s' not found in input schema", i, transType, sourceField))
			}
		}

		// Validate target field for transformations that need it
		switch transType {
		case "rename", "add", "copy", "cast", "split", "format_date", "parse_date":
			if targetField == "" {
				errors = append(errors, fmt.Errorf("transformation %d (%s): 'targetField' is required", i, transType))
			}
		}
	}

	return errors
}

