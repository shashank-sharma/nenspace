package transformations

import (
	"github.com/shashank-sharma/backend/internal/services/workflow/types"
)

type Transformation interface {
	Apply(record map[string]interface{}, config map[string]interface{}) error

	GetOutputSchema(inputSchema types.DataSchema, config map[string]interface{}) types.DataSchema

	ValidateConfig(config map[string]interface{}) error
}

type TransformationRegistry struct {
	transformations map[string]Transformation
}

func NewTransformationRegistry() *TransformationRegistry {
	return &TransformationRegistry{
		transformations: make(map[string]Transformation),
	}
}

func (r *TransformationRegistry) Register(transType string, transformation Transformation) {
	r.transformations[transType] = transformation
}

func (r *TransformationRegistry) Get(transType string) (Transformation, bool) {
	trans, exists := r.transformations[transType]
	return trans, exists
}

func (r *TransformationRegistry) GetAll() []string {
	types := make([]string, 0, len(r.transformations))
	for transType := range r.transformations {
		types = append(types, transType)
	}
	return types
}
