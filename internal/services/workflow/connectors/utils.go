package connectors

import (
	"fmt"
	"time"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

func InferSchemaFromData(data []map[string]interface{}, nodeID string) types.DataSchema {
	schema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: []string{nodeID},
	}

	if len(data) == 0 {
		return schema
	}

	fieldMap := make(map[string]types.FieldDefinition)
	for _, record := range data {
		for fieldName, value := range record {
			if _, exists := fieldMap[fieldName]; !exists {
				fieldType := InferFieldType(value)
				fieldMap[fieldName] = types.FieldDefinition{
					Name:       fieldName,
					Type:       fieldType,
					Nullable:   value == nil,
					SourceNode: nodeID,
				}
			} else {
				if value == nil {
					field := fieldMap[fieldName]
					field.Nullable = true
					fieldMap[fieldName] = field
				}
			}
		}
	}

	for _, field := range fieldMap {
		schema.Fields = append(schema.Fields, field)
	}

	return schema
}

func InferFieldType(value interface{}) string {
	if value == nil {
		return "string"
	}

	switch v := value.(type) {
	case bool:
		return "bool"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "number"
	case float32, float64:
		return "number"
	case string:
		if _, err := time.Parse(time.RFC3339, v); err == nil {
			return "date"
		}
		return "string"
	case time.Time:
		return "date"
	case []interface{}:
		return "json"
	case map[string]interface{}:
		return "json"
	default:
		return fmt.Sprintf("%T", value)
	}
}
