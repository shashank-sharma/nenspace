package transformations

import (
	"fmt"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type DeleteTransformation struct{}

func NewDeleteTransformation() Transformation {
	return &DeleteTransformation{}
}

func (t *DeleteTransformation) Apply(record map[string]interface{}, config map[string]interface{}) error {
	sourceField, _ := config["sourceField"].(string)
	if sourceField == "" {
		return fmt.Errorf("delete requires sourceField")
	}
	delete(record, sourceField)
	return nil
}

func (t *DeleteTransformation) GetOutputSchema(inputSchema types.DataSchema, config map[string]interface{}) types.DataSchema {
	outputSchema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0),
		SourceNodes: inputSchema.SourceNodes,
	}

	sourceField, _ := config["sourceField"].(string)

	for _, field := range inputSchema.Fields {
		if field.Name != sourceField {
			outputSchema.Fields = append(outputSchema.Fields, field)
		}
	}

	return outputSchema
}

func (t *DeleteTransformation) ValidateConfig(config map[string]interface{}) error {
	sourceField, _ := config["sourceField"].(string)
	if sourceField == "" {
		return fmt.Errorf("delete requires sourceField")
	}
	return nil
}
