package transformations

import (
	"fmt"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type RenameTransformation struct{}

func NewRenameTransformation() Transformation {
	return &RenameTransformation{}
}

func (t *RenameTransformation) Apply(record map[string]interface{}, config map[string]interface{}) error {
	sourceField, _ := config["sourceField"].(string)
	targetField, _ := config["targetField"].(string)

	if sourceField == "" || targetField == "" {
		return fmt.Errorf("rename requires both sourceField and targetField")
	}

	value, exists := record[sourceField]
	if !exists {
		return nil
	}

	record[targetField] = value
	delete(record, sourceField)
	return nil
}

func (t *RenameTransformation) GetOutputSchema(inputSchema types.DataSchema, config map[string]interface{}) types.DataSchema {
	outputSchema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: inputSchema.SourceNodes,
	}

	sourceField, _ := config["sourceField"].(string)
	targetField, _ := config["targetField"].(string)

	fieldMap := make(map[string]types.FieldDefinition)
	for _, field := range inputSchema.Fields {
		fieldMap[field.Name] = field
	}

	if sourceField != "" && targetField != "" {
		if field, exists := fieldMap[sourceField]; exists {
			field.Name = targetField
			if field.Description == "" {
				field.Description = fmt.Sprintf("Renamed from %s", sourceField)
			} else {
				field.Description = fmt.Sprintf("%s (renamed from %s)", field.Description, sourceField)
			}
			fieldMap[targetField] = field
			delete(fieldMap, sourceField)
		}
	}

	for _, field := range fieldMap {
		outputSchema.Fields = append(outputSchema.Fields, field)
	}

	return outputSchema
}

func (t *RenameTransformation) ValidateConfig(config map[string]interface{}) error {
	sourceField, _ := config["sourceField"].(string)
	targetField, _ := config["targetField"].(string)

	if sourceField == "" || targetField == "" {
		return fmt.Errorf("rename requires both sourceField and targetField")
	}

	return nil
}
