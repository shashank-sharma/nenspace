package transformations

import (
	"fmt"

	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type AddTransformation struct{}

func NewAddTransformation() Transformation {
	return &AddTransformation{}
}

func (t *AddTransformation) Apply(record map[string]interface{}, config map[string]interface{}) error {
	targetField, _ := config["targetField"].(string)
	if targetField == "" {
		return fmt.Errorf("add requires targetField")
	}

	if value, ok := config["value"]; ok && value != nil {
		record[targetField] = value
		return nil
	}

	record[targetField] = ""
	return nil
}

func (t *AddTransformation) GetOutputSchema(inputSchema types.DataSchema, config map[string]interface{}) types.DataSchema {
	outputSchema := types.DataSchema{
		Fields:      make([]types.FieldDefinition, 0, len(inputSchema.Fields)+1),
		SourceNodes: inputSchema.SourceNodes,
	}

	outputSchema.Fields = append(outputSchema.Fields, inputSchema.Fields...)

	targetField, _ := config["targetField"].(string)
	if targetField != "" {
		outputSchema.Fields = append(outputSchema.Fields, types.FieldDefinition{
			Name:     targetField,
			Type:     "string", // Default type
			Nullable: true,
		})
	}

	return outputSchema
}

func (t *AddTransformation) ValidateConfig(config map[string]interface{}) error {
	targetField, _ := config["targetField"].(string)
	if targetField == "" {
		return fmt.Errorf("add requires targetField")
	}
	return nil
}
